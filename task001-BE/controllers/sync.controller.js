const GitHubIntegration = require("../models/github-integration.model");
const GithubOrganization = require("../models/github-organization.model");
const GithubRepository = require("../models/github-repository.model");
const {
  handleCommits,
  handlePulls,
  handleIssues,
} = require("../utils/dataHandlers");
const axios = require("axios");

async function fetchAllPages(endpoint, headers) {
  let page = 1;
  let allData = [];
  let hasNextPage = true;
  const pageSize = 100;

  const separator = endpoint.includes("?") ? "&" : "?";

  while (hasNextPage) {
    try {
      const response = await axios.get(
        `${endpoint}${separator}page=${page}&per_page=${pageSize}`,
        { headers }
      );

      const data = response.data.map((item) => ({
        ...item,
        _page: page,
        _pageSize: pageSize,
      }));

      if (data.length === 0) {
        hasNextPage = false;
      } else {
        allData = [...allData, ...data];
        page++;
      }

      const remainingRequests = response.headers["x-ratelimit-remaining"];
      if (remainingRequests <= 0) {
        console.warn("GitHub API rate limit reached");
        break;
      }

      // Add a small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.error(
        "Error fetching page:",
        error.response?.data || error.message
      );
      break;
    }
  }

  return allData;
}

async function syncOrganizations(integration) {
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${integration.getDecryptedAccessToken()}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const orgsData = await fetchAllPages(
    "https://api.github.com/user/orgs",
    headers
  );

  const organizations = await Promise.all(
    orgsData.map(async (org) => {
      const orgData = {
        orgId: org.id.toString(),
        login: org.login,
        name: org.name || org.login,
        avatarUrl: org.avatar_url,
        description: org.description,
        url: org.url,
        reposUrl: org.repos_url,
        eventsUrl: org.events_url,
        hooksUrl: org.hooks_url,
        issuesUrl: org.issues_url,
        membersUrl: org.members_url,
        publicMembersUrl: org.public_members_url,
        githubIntegrationId: integration._id,
      };

      return GithubOrganization.findOneAndUpdate(
        { orgId: orgData.orgId },
        orgData,
        { upsert: true, new: true }
      );
    })
  );

  return organizations;
}

async function syncRepositories(integration, org = null) {
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${integration.getDecryptedAccessToken()}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const endpoint = org
    ? `https://api.github.com/orgs/${org.login}/repos`
    : "https://api.github.com/user/repos";

  const reposData = await fetchAllPages(endpoint, headers);

  const repositories = await Promise.all(
    reposData.map(async (repo) => {
      const repoData = {
        repoId: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        owner: {
          login: repo.owner.login,
          id: repo.owner.id,
          avatarUrl: repo.owner.avatar_url,
        },
        private: repo.private,
        description: repo.description,
        url: repo.url,
        htmlUrl: repo.html_url,
        createdAt: repo.created_at,
        updatedAt: repo.updated_at,
        githubIntegrationId: integration._id,
        ...(org && { orgId: org.orgId }),
      };

      return GithubRepository.findOneAndUpdate(
        { repoId: repoData.repoId },
        repoData,
        { upsert: true, new: true }
      );
    })
  );

  return repositories;
}

async function syncRepositoryData(integration, repository, orgId = null) {
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${integration.getDecryptedAccessToken()}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };

  let stats = {
    commits: 0,
    pulls: 0,
    issues: 0,
    errors: [],
  };

  try {
    // Fetch commits
    const commitsEndpoint = `https://api.github.com/repos/${repository.owner.login}/${repository.name}/commits`;
    try {
      const commitsData = await fetchAllPages(commitsEndpoint, headers);
      await handleCommits(commitsData, integration, repository.repoId, orgId);
      stats.commits = commitsData.length;
    } catch (error) {
      if (
        error.response?.status === 409 &&
        error.response?.data?.message?.includes("empty")
      ) {
        stats.errors.push(
          `Repository ${repository.name} is empty - no commits available`
        );
      } else {
        throw error;
      }
    }

    // Fetch pull requests
    const pullsEndpoint = `https://api.github.com/repos/${repository.owner.login}/${repository.name}/pulls?state=all`;
    try {
      const pullsData = await fetchAllPages(pullsEndpoint, headers);
      await handlePulls(pullsData, integration, repository.repoId, orgId);
      stats.pulls = pullsData.length;
    } catch (error) {
      stats.errors.push(
        `Failed to fetch pull requests for ${repository.name}: ${error.message}`
      );
    }

    // Fetch issues
    const issuesEndpoint = `https://api.github.com/repos/${repository.owner.login}/${repository.name}/issues?state=all&filter=all&sort=created&direction=desc`;
    try {
      const issuesData = await fetchAllPages(issuesEndpoint, headers);
      await handleIssues(issuesData, integration, repository.repoId, orgId);
      stats.issues = issuesData.filter((issue) => !issue.pull_request).length;
    } catch (error) {
      stats.errors.push(
        `Failed to fetch issues for ${repository.name}: ${error.message}`
      );
    }

    return stats;
  } catch (error) {
    console.error(`Error syncing repository ${repository.name}:`, error);
    stats.errors.push(`Failed to sync ${repository.name}: ${error.message}`);
    return stats;
  }
}

exports.syncAll = async (req, res) => {
  try {
    const user = req.user || req.session?.user;

    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const integration = await GitHubIntegration.findOne({
      githubId: user.githubId,
    });

    if (!integration) {
      return res.status(404).json({ error: "GitHub integration not found" });
    }

    // Sync organizations
    const organizations = await syncOrganizations(integration);

    // Sync repositories for each organization
    const orgRepos = await Promise.all(
      organizations.map(async (org) => {
        const repos = await syncRepositories(integration, org);
        return { org, repos };
      })
    );

    // Sync personal repositories
    const personalRepos = await syncRepositories(integration);

    // Sync data for all repositories
    const repoData = await Promise.all([
      ...personalRepos.map(async (repo) => ({
        repo: repo.name,
        data: await syncRepositoryData(integration, repo),
      })),
      ...orgRepos.flatMap(({ org, repos }) =>
        repos.map(async (repo) => ({
          org: org.login,
          repo: repo.name,
          data: await syncRepositoryData(integration, repo, org.orgId),
        }))
      ),
    ]);

    // Calculate totals and collect errors
    const totals = {
      commits: 0,
      pulls: 0,
      issues: 0,
    };
    const errors = [];

    repoData.forEach(({ repo, org, data }) => {
      totals.commits += data.commits;
      totals.pulls += data.pulls;
      totals.issues += data.issues;
      if (data.errors.length > 0) {
        errors.push(...data.errors);
      }
    });

    res.json({
      organizations: organizations.length,
      repositories: {
        personal: personalRepos.length,
        organizational: orgRepos.reduce(
          (sum, { repos }) => sum + repos.length,
          0
        ),
      },
      syncedData: {
        totals,
        details: repoData,
      },
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error in syncAll:", error);
    res.status(500).json({
      error: "Failed to sync data",
      details: error.response?.data || error.message,
    });
  }
};

// Make sure this is properly exported
module.exports = {
  syncAll: exports.syncAll,
};
