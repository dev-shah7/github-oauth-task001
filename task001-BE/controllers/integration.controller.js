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

async function fetchAndStoreCommitsPage(
  integration,
  repository,
  page = 1,
  pageSize = 20,
  orgId = null
) {
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${integration.getDecryptedAccessToken()}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };

  try {
    const commitsEndpoint = `https://api.github.com/repos/${repository.owner.login}/${repository.name}/commits?page=${page}&per_page=${pageSize}`;
    const response = await axios.get(commitsEndpoint, { headers });

    console.log(response.data, "res");
    const commits = response.data.map((commit) => ({
      repoId: repository.repoId,
      sha: commit.sha,
      commit: {
        author: {
          name: commit.commit.author.name,
          email: commit.commit.author.email,
          date: commit.commit.author.date,
        },
        committer: {
          name: commit.commit.committer.name,
          email: commit.commit.committer.email,
          date: commit.commit.committer.date,
        },
        message: commit.commit.message,
        comment_count: commit.commit.comment_count,
      },
      author: commit.author && {
        login: commit.author.login,
        id: commit.author.id,
        avatarUrl: commit.author.avatar_url,
      },
      committer: commit.committer && {
        login: commit.committer.login,
        id: commit.committer.id,
        avatarUrl: commit.committer.avatar_url,
      },
      githubIntegrationId: integration._id,
      ...(orgId && { orgId }),
      pageInfo: {
        page,
        pageSize,
        fetchedAt: new Date(),
      },
    }));

    if (commits.length > 0) {
      await handleCommits(commits, integration, repository.repoId, orgId);
    }

    return {
      commits,
      hasMore: commits.length === pageSize,
      remainingRequests: parseInt(response.headers["x-ratelimit-remaining"]),
    };
  } catch (error) {
    if (
      error.response?.status === 409 &&
      error.response?.data?.message?.includes("empty")
    ) {
      return {
        commits: [],
        hasMore: false,
        error: "Repository is empty",
      };
    }
    throw error;
  }
}

async function fetchAndStorePullsPage(
  integration,
  repository,
  page = 1,
  pageSize = 20,
  orgId = null
) {
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${integration.getDecryptedAccessToken()}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };

  try {
    const pullsEndpoint = `https://api.github.com/repos/${repository.owner.login}/${repository.name}/pulls?state=all&page=${page}&per_page=${pageSize}`;
    const response = await axios.get(pullsEndpoint, { headers });

    const pulls = response.data.map((pull) => ({
      repoId: repository.repoId,
      pullNumber: pull.number,
      title: pull.title,
      state: pull.state,
      user: {
        login: pull.user.login,
        id: pull.user.id,
        avatarUrl: pull.user.avatar_url,
      },
      body: pull.body,
      createdAt: pull.created_at,
      updatedAt: pull.updated_at,
      closedAt: pull.closed_at,
      mergedAt: pull.merged_at,
      url: pull.url,
      htmlUrl: pull.html_url,
      githubIntegrationId: integration._id,
      ...(orgId && { orgId }),
      pageInfo: {
        page,
        pageSize,
        fetchedAt: new Date(),
      },
    }));

    if (pulls.length > 0) {
      await handlePulls(pulls, integration, repository.repoId, orgId);
    }

    return {
      pulls,
      hasMore: pulls.length === pageSize,
      remainingRequests: parseInt(response.headers["x-ratelimit-remaining"]),
    };
  } catch (error) {
    throw error;
  }
}

async function fetchAndStoreIssuesPage(
  integration,
  repository,
  page = 1,
  pageSize = 20,
  orgId = null
) {
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${integration.getDecryptedAccessToken()}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };

  try {
    const issuesEndpoint = `https://api.github.com/repos/${repository.owner.login}/${repository.name}/issues?state=all&filter=all&sort=created&direction=desc&page=${page}&per_page=${pageSize}`;
    const response = await axios.get(issuesEndpoint, { headers });

    const issues = response.data
      .filter((issue) => !issue.pull_request) // Filter out pull requests
      .map((issue) => ({
        repoId: repository.repoId,
        issueNumber: issue.number,
        title: issue.title,
        state: issue.state,
        user: {
          login: issue.user.login,
          id: issue.user.id,
          avatarUrl: issue.user.avatar_url,
        },
        body: issue.body,
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        closedAt: issue.closed_at,
        url: issue.url,
        htmlUrl: issue.html_url,
        githubIntegrationId: integration._id,
        ...(orgId && { orgId }),
        pageInfo: {
          page,
          pageSize,
          fetchedAt: new Date(),
        },
      }));

    if (issues.length > 0) {
      await handleIssues(issues, integration, repository.repoId, orgId);
    }

    return {
      issues,
      hasMore: issues.length === pageSize,
      remainingRequests: parseInt(response.headers["x-ratelimit-remaining"]),
    };
  } catch (error) {
    throw error;
  }
}

exports.getRepositoryData = async (req, res) => {
  try {
    const { orgId, dataType } = req.params;
    const { owner, repo: repoName, page = 1, pageSize = 20 } = req.body;
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

    switch (dataType) {
      case "commits":
        try {
          const result = await fetchAndStoreCommitsPage(
            integration,
            repository,
            page,
            pageSize,
            orgId
          );

          if (result.error) {
            return res.json({
              data: [],
              pagination: {
                hasMore: false,
                currentPage: page,
                pageSize,
                error: result.error,
              },
            });
          }

          return res.json({
            data: result.commits,
            pagination: {
              hasMore: result.hasMore,
              currentPage: page,
              pageSize,
              remainingRequests: result.remainingRequests,
            },
          });
        } catch (error) {
          console.error("Error fetching commits:", error);
          throw error;
        }

      case "pulls":
        try {
          const result = await fetchAndStorePullsPage(
            integration,
            repository,
            page,
            pageSize,
            orgId
          );

          return res.json({
            data: result.pulls,
            pagination: {
              hasMore: result.hasMore,
              currentPage: page,
              pageSize,
              remainingRequests: result.remainingRequests,
            },
          });
        } catch (error) {
          console.error("Error fetching pulls:", error);
          throw error;
        }

      case "issues":
        try {
          const result = await fetchAndStoreIssuesPage(
            integration,
            repository,
            page,
            pageSize,
            orgId
          );

          return res.json({
            data: result.issues,
            pagination: {
              hasMore: result.hasMore,
              currentPage: page,
              pageSize,
              remainingRequests: result.remainingRequests,
            },
          });
        } catch (error) {
          console.error("Error fetching issues:", error);
          throw error;
        }

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
    const { owner, repo: repoName, page = 1, pageSize = 20 } = req.body;
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

    switch (type) {
      case "commits":
        try {
          const result = await fetchAndStoreCommitsPage(
            integration,
            repository,
            page,
            pageSize
          );

          if (result.error) {
            return res.json({
              data: [],
              pagination: {
                hasMore: false,
                currentPage: page,
                pageSize,
                error: result.error,
              },
            });
          }

          return res.json({
            data: result.commits,
            pagination: {
              hasMore: result.hasMore,
              currentPage: page,
              pageSize,
              remainingRequests: result.remainingRequests,
            },
          });
        } catch (error) {
          console.error("Error fetching commits:", error);
          throw error;
        }

      case "pulls":
        try {
          const result = await fetchAndStorePullsPage(
            integration,
            repository,
            page,
            pageSize
          );

          return res.json({
            data: result.pulls,
            pagination: {
              hasMore: result.hasMore,
              currentPage: page,
              pageSize,
              remainingRequests: result.remainingRequests,
            },
          });
        } catch (error) {
          console.error("Error fetching pulls:", error);
          throw error;
        }

      case "issues":
        try {
          const result = await fetchAndStoreIssuesPage(
            integration,
            repository,
            page,
            pageSize
          );

          return res.json({
            data: result.issues,
            pagination: {
              hasMore: result.hasMore,
              currentPage: page,
              pageSize,
              remainingRequests: result.remainingRequests,
            },
          });
        } catch (error) {
          console.error("Error fetching issues:", error);
          throw error;
        }

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
