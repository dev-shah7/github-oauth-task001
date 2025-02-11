const GitHubIntegration = require("../models/github-integration.model");

const authenticateToken = async (req, res, next) => {
  try {
    const user = req.user || req.session?.user;
    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    next();
  } catch (error) {
    console.error("Auth error:", error);
    res.status(401).json({ error: "Authentication failed" });
  }
};

const validateUser = async (req, res) => {
  const user = req.user || req.session?.user;
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }

  const integration = await GitHubIntegration.findOne({
    githubId: user.githubId,
  });

  if (!integration) {
    res.status(404).json({ error: "GitHub integration not found" });
    return null;
  }

  return integration;
};

module.exports = {
  authenticateToken,
  validateUser,
};
