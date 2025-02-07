const mongoose = require("mongoose");
const { decrypt } = require("../utils/encryption");

const githubIntegrationSchema = new mongoose.Schema({
  githubId: {
    type: String,
    required: true,
    unique: true,
  },
  username: {
    type: String,
    required: true,
  },
  avatarUrl: String,
  email: String,
  accessToken: {
    type: String,
    required: true,
  },
  refreshToken: String,
  profile: {
    name: String,
    bio: String,
    location: String,
    company: String,
    blog: String,
    publicRepos: Number,
    followers: Number,
    following: Number,
  },
  connectionDate: {
    type: Date,
    default: Date.now,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
});

githubIntegrationSchema.methods.getDecryptedAccessToken = function () {
  return decrypt(this.accessToken);
};

githubIntegrationSchema.methods.getDecryptedRefreshToken = function () {
  return this.refreshToken ? decrypt(this.refreshToken) : null;
};

module.exports = mongoose.model(
  "GitHubIntegration",
  githubIntegrationSchema,
  "github-integration"
);
