const GitHubIntegration = require("../models/github-integration.model");
const GithubOrganization = require("../models/github-organization.model");
const axios = require("axios");
const GithubRepository = require("../models/github-repository.model");
const GithubCommit = require("../models/github-commit.model");
const GithubPullRequest = require("../models/github-pull-request.model");

exports.getIntegrations = async (req, res) => {
  try {
    const githubIntegrations = await GitHubIntegration.find();

    if (githubIntegrations.length === 0) {
      return res.json([]);
    }

    const integrations = githubIntegrations.map((integration) => ({
      id: "github",
      name: `GitHub (${integration.username})`,
      type: "github",
      status: "active",
    }));

    res.json(integrations);
  } catch (error) {
    console.error("Error in getIntegrations:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.getGithubOrganizations = async (req, res) => {
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

    const response = await axios.get(`https://api.github.com/user/orgs`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${decryptedToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    // Store or update organizations
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

        return await GithubOrganization.findOneAndUpdate(
          { orgId: orgData.orgId },
          orgData,
          { upsert: true, new: true }
        );
      })
    );

    res.json(organizations);
  } catch (error) {
    console.error("Error fetching GitHub organizations:", error);
    res.status(500).json({
      error: "Failed to fetch organizations",
      details: error.response?.data || error.message,
    });
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

        // Store repositories
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

exports.getRepositoryData = async (req, res) => {
  try {
    const { orgId, dataType } = req.params;
    const { owner, repo } = req.body;
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
      case "commits":
        endpoint = `https://api.github.com/repos/${owner}/${repo}/commits`;
        break;
      case "pulls":
        endpoint = `https://api.github.com/repos/${owner}/${repo}/pulls`;
        break;
      case "issues":
        endpoint = `https://api.github.com/repos/${owner}/${repo}/issues`;
        break;
      default:
        return res.status(400).json({ error: "Invalid repository data type" });
    }

    const response = await axios.get(endpoint, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${decryptedToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    switch (dataType) {
      case "commits":
        const commits = await Promise.all(
          response.data.map(async (commit) => {
            const commitData = {
              orgId: organization.orgId,
              repoId: repo.repoId,
              sha: commit.sha,
              commit: {
                author: commit.commit.author,
                message: commit.commit.message,
              },
              author: commit.author && {
                login: commit.author.login,
                id: commit.author.id,
                avatarUrl: commit.author.avatar_url,
              },
              url: commit.url,
              htmlUrl: commit.html_url,
              githubIntegrationId: integration._id,
            };

            return await GithubCommit.findOneAndUpdate(
              { sha: commitData.sha },
              commitData,
              { upsert: true, new: true }
            );
          })
        );
        return res.json(commits);

      case "pulls":
        const pulls = await Promise.all(
          response.data.map(async (pr) => {
            const prData = {
              orgId: organization.orgId,
              repoId: repo.repoId,
              number: pr.number,
              title: pr.title,
              state: pr.state,
              user: {
                login: pr.user.login,
                id: pr.user.id,
                avatarUrl: pr.user.avatar_url,
              },
              body: pr.body,
              createdAt: pr.created_at,
              updatedAt: pr.updated_at,
              closedAt: pr.closed_at,
              mergedAt: pr.merged_at,
              url: pr.url,
              htmlUrl: pr.html_url,
              githubIntegrationId: integration._id,
            };

            return await GithubPullRequest.findOneAndUpdate(
              {
                repoId: prData.repoId,
                number: prData.number,
              },
              prData,
              { upsert: true, new: true }
            );
          })
        );
        return res.json(pulls);

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
