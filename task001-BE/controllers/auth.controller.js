const axios = require("axios");
const GitHubIntegration = require("../models/GitHubIntegration");

exports.handleGithubCallback = (req, res) => {
  try {
    res.json({
      success: true,
      user: {
        id: req.user.id,
        username: req.user.username,
        displayName: req.user.displayName,
      },
    });
  } catch (error) {
    console.error("GitHub auth error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
};

exports.getIntegrationStatus = async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.json({
        isConnected: false,
        connectionDate: null,
        userData: null,
      });
    }

    const integration = await GitHubIntegration.findOne({
      githubId: req.user.id,
    });

    if (!integration) {
      return res.json({
        isConnected: false,
        connectionDate: null,
        userData: null,
      });
    }

    res.json({
      isConnected: true,
      connectionDate: integration.connectionDate,
      userData: {
        id: integration.githubId,
        username: integration.username,
        email: integration.email,
        avatarUrl: integration.avatarUrl,
        profile: integration.profile,
      },
    });
  } catch (error) {
    console.error("Error getting integration status:", error);
    res.status(500).json({ error: "Failed to get integration status" });
  }
};

exports.removeIntegration = async (req, res) => {
  try {
    if (req.isAuthenticated()) {
      await GitHubIntegration.deleteOne({ githubId: req.user.id });
      req.logout((err) => {
        if (err) {
          return res
            .status(500)
            .json({ error: "Failed to remove integration" });
        }
        res.json({ success: true });
      });
    } else {
      res.status(401).json({ error: "Not authenticated" });
    }
  } catch (error) {
    console.error("Error removing integration:", error);
    res.status(500).json({ error: "Failed to remove integration" });
  }
};
