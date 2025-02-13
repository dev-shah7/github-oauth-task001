const mongoose = require("mongoose");

const githubCommitSchema = new mongoose.Schema({
  repoId: {
    type: String,
    required: true,
    index: true,
  },
  sha: {
    type: String,
    required: true,
  },
  url: String,
  html_url: String,
  commit: {
    author: {
      name: String,
      email: String,
      date: Date,
    },
    committer: {
      name: String,
      email: String,
      date: Date,
    },
    message: String,
    comment_count: Number,
    verification: {
      verified: Boolean,
      reason: String,
      signature: String,
      payload: String,
    },
  },
  author: {
    login: String,
    id: Number,
    avatar_url: String,
    url: String,
    html_url: String,
  },
  committer: {
    login: String,
    id: Number,
    avatar_url: String,
    url: String,
    html_url: String,
  },
  parents: [
    {
      sha: String,
      url: String,
    },
  ],
  githubIntegrationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "GitHubIntegration",
    required: true,
  },
  orgId: String,
  // Add pagination info
  pageInfo: {
    page: Number,
    pageSize: Number,
    fetchedAt: {
      type: Date,
      default: Date.now,
    },
  },
});

githubCommitSchema.index({ repoId: 1, sha: 1 }, { unique: true });

module.exports = mongoose.model("GithubCommit", githubCommitSchema);
