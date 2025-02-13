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
const mongoose = require("mongoose");
const { Octokit } = require("octokit");
const Commit = require("../models/github-commit.model");
const PullRequest = require("../models/github-pull-request.model");
const Issue = require("../models/github-issue.model");

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

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
              id: repo.id,
              name: repo.name,
              full_name: repo.full_name,
              owner: {
                login: repo.owner.login,
                id: repo.owner.id,
                avatar_url: repo.owner.avatar_url,
                html_url: repo.owner.html_url,
                type: repo.owner.type,
              },
              private: repo.private,
              html_url: repo.html_url,
              description: repo.description,
              fork: repo.fork,
              homepage: repo.homepage,
              language: repo.language,

              // Repository stats
              forks_count: repo.forks_count,
              stargazers_count: repo.stargazers_count,
              watchers_count: repo.watchers_count,
              open_issues_count: repo.open_issues_count,
              size: repo.size,

              // Repository features
              has_issues: repo.has_issues,
              has_projects: repo.has_projects,
              has_wiki: repo.has_wiki,
              has_pages: repo.has_pages,
              has_downloads: repo.has_downloads,
              has_discussions: repo.has_discussions,

              // Repository status
              archived: repo.archived,
              disabled: repo.disabled,
              visibility: repo.visibility,
              default_branch: repo.default_branch,

              // Topics/Tags
              topics: repo.topics || [],

              // Timestamps
              created_at: repo.created_at,
              updated_at: repo.updated_at,
              pushed_at: repo.pushed_at,

              // URLs
              clone_url: repo.clone_url,
              ssh_url: repo.ssh_url,
              svn_url: repo.svn_url,

              // Permissions
              permissions: repo.permissions,

              // Security features
              security: {
                advanced_security:
                  repo.security_and_analysis?.advanced_security?.status ||
                  "disabled",
                secret_scanning:
                  repo.security_and_analysis?.secret_scanning?.status ||
                  "disabled",
                secret_scanning_push_protection:
                  repo.security_and_analysis?.secret_scanning_push_protection
                    ?.status || "disabled",
              },

              // Additional metadata
              orgId: organization.orgId,
              githubIntegrationId: integration._id,
            };
            return await GithubRepository.findOneAndUpdate(
              { repoId: repoData.id },
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

    const commits = response.data.map((commit) => ({
      repoId: repository.repoId,
      sha: commit.sha,
      url: commit.url,
      html_url: commit.html_url,
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
        verification: commit.commit.verification,
      },
      author: commit.author && {
        login: commit.author.login,
        id: commit.author.id,
        avatar_url: commit.author.avatar_url,
        url: commit.author.url,
        html_url: commit.author.html_url,
      },
      committer: commit.committer && {
        login: commit.committer.login,
        id: commit.committer.id,
        avatar_url: commit.committer.avatar_url,
        url: commit.committer.url,
        html_url: commit.committer.html_url,
      },
      parents: commit.parents.map((parent) => ({
        sha: parent.sha,
        url: parent.url,
      })),
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
          id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
          owner: {
            login: repo.owner.login,
            id: repo.owner.id,
            avatar_url: repo.owner.avatar_url,
            html_url: repo.owner.html_url,
            type: repo.owner.type,
          },
          private: repo.private,
          html_url: repo.html_url,
          description: repo.description,
          fork: repo.fork,
          homepage: repo.homepage,
          language: repo.language,

          // Repository stats
          forks_count: repo.forks_count,
          stargazers_count: repo.stargazers_count,
          watchers_count: repo.watchers_count,
          open_issues_count: repo.open_issues_count,
          size: repo.size,

          // Repository features
          has_issues: repo.has_issues,
          has_projects: repo.has_projects,
          has_wiki: repo.has_wiki,
          has_pages: repo.has_pages,
          has_downloads: repo.has_downloads,
          has_discussions: repo.has_discussions,

          // Repository status
          archived: repo.archived,
          disabled: repo.disabled,
          visibility: repo.visibility,
          default_branch: repo.default_branch,

          // Topics/Tags
          topics: repo.topics || [],

          // Timestamps
          created_at: repo.created_at,
          updated_at: repo.updated_at,
          pushed_at: repo.pushed_at,

          // URLs
          clone_url: repo.clone_url,
          ssh_url: repo.ssh_url,
          svn_url: repo.svn_url,

          // Permissions
          permissions: repo.permissions,

          // Security features
          security: {
            advanced_security:
              repo.security_and_analysis?.advanced_security?.status ||
              "disabled",
            secret_scanning:
              repo.security_and_analysis?.secret_scanning?.status || "disabled",
            secret_scanning_push_protection:
              repo.security_and_analysis?.secret_scanning_push_protection
                ?.status || "disabled",
          },

          // Additional metadata
          orgId: organization.orgId,
          githubIntegrationId: integration._id,
        };
        return await GithubRepository.findOneAndUpdate(
          { repoId: repoData.id },
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

exports.getStoredRepos = async (req, res) => {
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

    // Fetch repositories from MongoDB
    const repositories = await GithubRepository.find({
      githubIntegrationId: integration._id,
    })
      .select({
        id: 1,
        name: 1,
        full_name: 1,
        owner: 1,
        repoId: 1,
        description: 1,
        html_url: 1,
        updated_at: 1,
      })
      .sort({ updated_at: -1 });

    res.json(repositories);
  } catch (error) {
    console.error("Error fetching stored repos:", error);
    res.status(500).json({
      error: "Failed to fetch repositories",
      details: error.message,
    });
  }
};

// Get detailed issue information with related items
exports.getIssueDetails = async (req, res) => {
  try {
    const { owner, repo, issueNumber } = req.params;
    const issueNum = parseInt(issueNumber);

    // Validate user authentication
    const user = req.user || req.session?.user;
    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Get GitHub integration
    const integration = await GitHubIntegration.findOne({
      githubId: user.githubId,
    });

    if (!integration) {
      return res.status(404).json({ error: "GitHub integration not found" });
    }

    // Create authenticated Octokit instance with user's token
    const userOctokit = new Octokit({
      auth: integration.getDecryptedAccessToken(),
    });

    try {
      // Get issue details and comments in parallel with timeout
      const [issueDetails, comments] = await Promise.all([
        userOctokit.rest.issues
          .get({
            owner,
            repo,
            issue_number: issueNum,
            headers: {
              "If-None-Match": "", // Bypass cache to avoid stale data
            },
          })
          .catch((error) => {
            if (error.status === 403 && error.message.includes("rate limit")) {
              throw new Error(
                "API rate limit exceeded. Please try again later."
              );
            }
            console.error("Error fetching issue:", error);
            throw new Error("Failed to fetch issue details");
          }),

        userOctokit.rest.issues
          .listComments({
            owner,
            repo,
            issue_number: issueNum,
            per_page: 100,
            headers: {
              "If-None-Match": "", // Bypass cache to avoid stale data
            },
          })
          .catch((error) => {
            console.error("Error fetching comments:", error);
            return { data: [] }; // Return empty comments if fetch fails
          }),
      ]);

      // Format the response
      const response = {
        details: issueDetails.data,
        comments: comments.data,
      };

      res.json(response);
    } catch (error) {
      console.error("Error in GitHub API calls:", error);
      res.status(error.message.includes("rate limit") ? 429 : 500).json({
        error: "Failed to fetch issue details",
        message: error.message,
      });
    }
  } catch (error) {
    console.error("Error in getIssueDetails:", error);
    res.status(500).json({
      error: "Server error",
      message: error.message,
    });
  }
};

function getEventDescription(event) {
  switch (event.event) {
    case "referenced":
      return `Referenced in ${event.commit_id ? "commit" : "issue/PR"} ${
        event.commit_id || event.issue?.number
      }`;
    case "assigned":
      return `Assigned to ${event.assignee?.login}`;
    case "labeled":
      return `Added label "${event.label?.name}"`;
    case "unlabeled":
      return `Removed label "${event.label?.name}"`;
    case "closed":
      return event.commit_id
        ? `Closed via ${event.commit_id.substring(0, 7)}`
        : "Closed";
    case "reopened":
      return "Reopened";
    default:
      return event.event;
  }
}

// Similar endpoints for PRs and commits
exports.getPRDetails = async (req, res) => {
  // Similar implementation for pull requests
};

exports.getCommitDetails = async (req, res) => {
  try {
    const { owner, repo, sha } = req.params;

    // Validate user authentication
    const user = req.user || req.session?.user;
    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Get GitHub integration
    const integration = await GitHubIntegration.findOne({
      githubId: user.githubId,
    });

    if (!integration) {
      return res.status(404).json({ error: "GitHub integration not found" });
    }

    // Create authenticated Octokit instance with user's token
    const userOctokit = new Octokit({
      auth: integration.getDecryptedAccessToken(),
    });

    try {
      // Get commit details and comments in parallel
      const [commitDetails, comments] = await Promise.all([
        userOctokit.rest.repos
          .getCommit({
            owner,
            repo,
            ref: sha,
            headers: {
              "If-None-Match": "", // Bypass cache
            },
          })
          .catch((error) => {
            if (error.status === 403 && error.message.includes("rate limit")) {
              throw new Error(
                "API rate limit exceeded. Please try again later."
              );
            }
            throw error;
          }),

        userOctokit.rest.repos
          .listCommentsForCommit({
            owner,
            repo,
            commit_sha: sha,
            per_page: 100,
            headers: {
              "If-None-Match": "", // Bypass cache
            },
          })
          .catch((error) => {
            console.error("Error fetching comments:", error);
            return { data: [] }; // Return empty comments if fetch fails
          }),
      ]);

      // Format the response
      const response = {
        details: {
          sha: commitDetails.data.sha,
          message: commitDetails.data.commit.message,
          author: {
            name: commitDetails.data.commit.author.name,
            email: commitDetails.data.commit.author.email,
            date: commitDetails.data.commit.author.date,
          },
          committer: {
            name: commitDetails.data.commit.committer.name,
            email: commitDetails.data.commit.committer.email,
            date: commitDetails.data.commit.committer.date,
          },
          user: commitDetails.data.author || commitDetails.data.committer,
          stats: commitDetails.data.stats,
          files: commitDetails.data.files.map((file) => ({
            filename: file.filename,
            status: file.status,
            additions: file.additions,
            deletions: file.deletions,
            changes: file.changes,
            patch: file.patch,
          })),
          html_url: commitDetails.data.html_url,
        },
        comments: comments.data,
      };

      res.json(response);
    } catch (error) {
      console.error("Error in GitHub API calls:", error);
      res.status(error.message.includes("rate limit") ? 429 : 500).json({
        error: "Failed to fetch commit details",
        message: error.message,
      });
    }
  } catch (error) {
    console.error("Error in getCommitDetails:", error);
    res.status(500).json({
      error: "Server error",
      message: error.message,
    });
  }
};
