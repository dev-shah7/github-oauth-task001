const GitHubIntegration = require("../models/github-integration.model");
const GithubOrganization = require("../models/github-organization.model");
const axios = require("axios");

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

    // Handle repository-specific endpoints
    if (dataType.startsWith("repos/")) {
      const [, owner, repo, subType] = dataType.split("/");

      console.log("subType", subType);
      console.log("owner", owner);
      console.log("repo", repo);
      switch (subType) {
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
          return res
            .status(400)
            .json({ error: "Invalid repository data type" });
      }
    } else {
      // Handle organization-level data types
      switch (dataType) {
        case "members":
          endpoint = `https://api.github.com/orgs/${organization.login}/members`;
          break;
        case "repos":
          endpoint = `https://api.github.com/orgs/${organization.login}/repos`;
          break;
        default:
          return res.status(400).json({ error: "Invalid data type requested" });
      }
    }

    const response = await axios.get(endpoint, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${decryptedToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    res.json(response.data);
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

    res.json(response.data);
  } catch (error) {
    console.error("Error fetching repository data:", error);
    res.status(500).json({
      error: "Failed to fetch repository data",
      details: error.response?.data || error.message,
    });
  }
};
