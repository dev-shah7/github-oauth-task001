const GithubIntegration = require("../models/github-integration.model");
const axios = require("axios");

exports.getIntegrations = async (req, res) => {
  try {
    console.log("Getting integrations...");

    const githubIntegrations = await GithubIntegration.db
      .collection("github-integrations")
      .find()
      .toArray();
    console.log("Raw MongoDB result:", githubIntegrations);

    if (githubIntegrations.length === 0) {
      console.log("No integrations found in the database");
      return res.json([]);
    }

    const integrations = githubIntegrations.map((integration) => ({
      id: "github",
      name: `GitHub (${integration.username})`,
      type: "github",
      status: "active",
    }));

    console.log("Sending integrations:", integrations);
    res.json(integrations);
  } catch (error) {
    console.error("Error in getIntegrations:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.getGithubOrganizations = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const integration = await GithubIntegration.db
      .collection("github-integrations")
      .findOne({ githubId: req.user.githubId });

    if (!integration || !integration.accessToken) {
      return res.status(404).json({ error: "GitHub integration not found" });
    }

    const response = await axios.get("https://api.github.com/user/orgs", {
      headers: {
        Authorization: `Bearer ${integration.accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    const organizations = response.data.map((org) => ({
      id: org.id,
      login: org.login,
      name: org.name || org.login,
      avatarUrl: org.avatar_url,
      description: org.description,
    }));

    res.json(organizations);
  } catch (error) {
    console.error("Error fetching GitHub organizations:", error);
    res.status(500).json({
      error: "Failed to fetch organizations",
      details: error.response?.data || error.message,
    });
  }
};
