const GitHubIntegration = require("../models/github-integration.model");
const GithubOrganization = require("../models/github-organization.model");
const GithubRepository = require("../models/github-repository.model");
const { handleApiError } = require("../utils/errorHandler");
const { validateUser } = require("../middleware/auth.middleware");
const {
  fetchGithubData,
  getAuthHeaders,
} = require("../services/github.service");
const {
  handleCommits,
  handlePulls,
  handleIssues,
} = require("../utils/dataHandlers");
const axios = require("axios");

exports.getIntegrations = async (req, res) => {
  try {
    const githubIntegrations = await GitHubIntegration.find();
    if (githubIntegrations.length === 0) return res.json([]);

    const integrations = githubIntegrations.map((integration) => ({
      id: "github",
      name: `GitHub (${integration.username})`,
      type: "github",
      status: "active",
    }));

    res.json(integrations);
  } catch (error) {
    handleApiError(error, res, "Error in getIntegrations");
  }
};

exports.getGithubOrganizations = async (req, res) => {
  try {
    const integration = await validateUser(req, res);
    if (!integration) return;

    const token = integration.getDecryptedAccessToken();
    const response = await fetchGithubData("/user/orgs", token);

    const organizations = await Promise.all(
      response.data.map(async (org) => {
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

    res.json(organizations);
  } catch (error) {
    handleApiError(error, res, "Failed to fetch organizations");
  }
};

exports.getOrganizationData = async (req, res) => {
  try {
    const { orgId, dataType } = req.params;
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

    const organization = await GithubOrganization.findOne({ orgId });
    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const decryptedToken = integration.getDecryptedAccessToken();
    let endpoint;

    switch (dataType) {
      case "members":
        endpoint = `https://api.github.com/orgs/${organization.login}/members`;
        const membersResponse = await axios.get(endpoint, {
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${decryptedToken}`,
            "X-GitHub-Api-Version": "2022-11-28",
          },
        });
        return res.json(membersResponse.data);

      case "repos":
        endpoint = `https://api.github.com/orgs/${organization.login}/repos`;
        const response = await axios.get(endpoint, {
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${decryptedToken}`,
            "X-GitHub-Api-Version": "2022-11-28",
          },
        });

        const repositories = await Promise.all(
          response.data.map(async (repo) => {
            const repoData = {
              orgId: organization.orgId,
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
            };
            return await GithubRepository.findOneAndUpdate(
              { repoId: repoData.repoId },
              repoData,
              { upsert: true, new: true }
            );
          })
        );
        return res.json(repositories);

      default:
        return res.status(400).json({ error: "Invalid data type requested" });
    }
  } catch (error) {
    console.error("Error fetching organization data:", error);
    res.status(500).json({
      error: "Failed to fetch organization data",
      details: error.response?.data || error.message,
    });
  }
};

async function fetchAllPages(endpoint, headers) {
  let page = 1;
  let allData = [];
  let hasNextPage = true;
  const pageSize = 100;

  // Handle existing query parameters in endpoint
  const separator = endpoint.includes("?") ? "&" : "?";

  while (hasNextPage) {
    try {
      const response = await axios.get(
        `${endpoint}${separator}page=${page}&per_page=${pageSize}`,
        {
          headers,
        }
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

exports.getRepositoryData = async (req, res) => {
  try {
    const { orgId, dataType } = req.params;
    const { owner, repo: repoName } = req.body; // Renamed to avoid confusion
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

    const organization = await GithubOrganization.findOne({ orgId });
    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const decryptedToken = integration.getDecryptedAccessToken();
    const headers = {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${decryptedToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
    };

    let endpoint;
    switch (dataType) {
      case "commits":
        endpoint = `https://api.github.com/repos/${owner}/${repoName}/commits`;
        break;
      case "pulls":
        endpoint = `https://api.github.com/repos/${owner}/${repoName}/pulls?state=all`;
        break;
      case "issues":
        endpoint = `https://api.github.com/repos/${owner}/${repoName}/issues?state=all&filter=all&sort=created&direction=desc`;
        break;
      default:
        return res.status(400).json({ error: "Invalid repository data type" });
    }

    const allData = await fetchAllPages(endpoint, headers);

    // Get the repository ID from the database
    const repository = await GithubRepository.findOne({
      name: repoName,
      "owner.login": owner,
    });

    if (!repository) {
      return res
        .status(404)
        .json({ error: "Repository not found in database" });
    }

    const repoId = repository.repoId;

    switch (dataType) {
      case "commits":
        const commits = await handleCommits(
          allData,
          integration,
          repoId,
          orgId
        );
        return res.json(commits);

      case "pulls":
        const pulls = await handlePulls(allData, integration, repoId, orgId);
        return res.json(pulls);

      case "issues":
        const issues = await handleIssues(allData, integration, repoId, orgId);
        return res.json(issues);

      default:
        return res.status(400).json({ error: "Invalid repository data type" });
    }
  } catch (error) {
    console.error("Error fetching repository data:", error);
    res.status(500).json({
      error: "Failed to fetch repository data",
      details: error.response?.data || error.message,
    });
  }
};

exports.getUserRepos = async (req, res) => {
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

    const decryptedToken = integration.getDecryptedAccessToken();

    const response = await axios.get("https://api.github.com/user/repos", {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${decryptedToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    const repositories = await Promise.all(
      response.data.map(async (repo) => {
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
        };
        return await GithubRepository.findOneAndUpdate(
          { repoId: repoData.repoId },
          repoData,
          { upsert: true, new: true }
        );
      })
    );

    res.json(repositories);
  } catch (error) {
    console.error("Error fetching user repos:", error);
    res.status(500).json({
      error: "Failed to fetch repositories",
      details: error.response?.data || error.message,
    });
  }
};

exports.getUserRepoData = async (req, res) => {
  try {
    const { owner, repo: repoName } = req.body;
    const { type } = req.params;
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

    const decryptedToken = integration.getDecryptedAccessToken();
    const headers = {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${decryptedToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
    };

    let endpoint;
    switch (type) {
      case "commits":
        endpoint = `https://api.github.com/repos/${owner}/${repoName}/commits`;
        break;
      case "pulls":
        endpoint = `https://api.github.com/repos/${owner}/${repoName}/pulls?state=all`;
        break;
      case "issues":
        endpoint = `https://api.github.com/repos/${owner}/${repoName}/issues?state=all&filter=all&sort=created&direction=desc`;
        break;
      default:
        return res.status(400).json({ error: "Invalid repository data type" });
    }

    const allData = await fetchAllPages(endpoint, headers);

    // Get the repository ID from the database
    const repository = await GithubRepository.findOne({
      name: repoName,
      "owner.login": owner,
    });

    if (!repository) {
      return res
        .status(404)
        .json({ error: "Repository not found in database" });
    }

    const repoId = repository.repoId;

    switch (type) {
      case "commits":
        const commits = await handleCommits(allData, integration, repoId);
        return res.json(commits);

      case "pulls":
        const pulls = await handlePulls(allData, integration, repoId);
        return res.json(pulls);

      case "issues":
        const issues = await handleIssues(allData, integration, repoId);
        return res.json(issues);

      default:
        return res.status(400).json({ error: "Invalid repository data type" });
    }
  } catch (error) {
    console.error("Error fetching repository data:", error);
    res.status(500).json({
      error: "Failed to fetch repository data",
      details: error.response?.data || error.message,
    });
  }
};
