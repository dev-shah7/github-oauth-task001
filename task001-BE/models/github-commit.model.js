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
  },
  author: {
    login: String,
    id: Number,
    avatarUrl: String,
  },
  committer: {
    login: String,
    id: Number,
    avatarUrl: String,
  },
  url: String,
  htmlUrl: String,
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
