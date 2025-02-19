const axios = require("axios");
const GitHubIntegration = require("../models/GitHubIntegration");

exports.handleGithubCallback = (req, res) => {
  try {
    req.login(req.user, async (loginErr) => {
      if (loginErr) {
        console.error("Error logging in the user:", loginErr);
        return res.status(500).send("Error during login.");
      }

      req.session.user = req.user;

      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).send("Error saving session");
        }
        res.redirect("http://localhost:4200/");
      });
    });
  } catch (error) {
    console.error("GitHub auth error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
};

exports.getIntegrationStatus = async (req, res) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.json({
        isConnected: false,
        connectionDate: null,
        userData: null,
      });
    }

    const integration = await GitHubIntegration.findOne({
      githubId: req.user.githubId || req.user.id,
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
      const githubId = req.user.githubId;

      const result = await GitHubIntegration.findOneAndDelete({ githubId });

      if (!result) {
        return res.status(404).json({ error: "Integration not found" });
      }

      req.logout((err) => {
        if (err) {
          return res
            .status(500)
            .json({ error: "Failed to remove integration" });
        }
        req.session.destroy((sessionErr) => {
          if (sessionErr) {
            console.error("Session destroy error:", sessionErr);
          }
          res.json({ success: true });
        });
      });
    } else {
      res.status(401).json({ error: "Not authenticated" });
    }
  } catch (error) {
    console.error("Error removing integration:", error);
    res.status(500).json({ error: "Failed to remove integration" });
  }
};
