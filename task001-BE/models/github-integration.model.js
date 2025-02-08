const mongoose = require("mongoose");

const githubIntegrationSchema = new mongoose.Schema(
  {
    githubId: String,
    username: String,
    avatarUrl: String,
    email: String,
    accessToken: String,
    refreshToken: String,
    profile: Object,
    lastUpdated: Date,
    connectionDate: Date,
  },
  { collection: "github-integrations" }
);

module.exports = mongoose.model("GithubIntegration", githubIntegrationSchema);
