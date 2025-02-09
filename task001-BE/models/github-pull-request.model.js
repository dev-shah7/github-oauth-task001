const mongoose = require("mongoose");

const githubPullRequestSchema = new mongoose.Schema(
  {
    orgId: {
      type: String,
      required: true,
      ref: "GithubOrganization",
      index: true,
    },
    repoId: {
      type: Number,
      required: true,
      ref: "GithubRepository",
      index: true,
    },
    number: {
      type: Number,
      required: true,
    },
    title: String,
    state: {
      type: String,
      index: true,
    },
    user: {
      login: String,
      id: Number,
      avatarUrl: String,
    },
    body: String,
    createdAt: {
      type: Date,
      index: true,
    },
    updatedAt: Date,
    closedAt: Date,
    mergedAt: Date,
    url: String,
    htmlUrl: String,
    githubIntegrationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GitHubIntegration",
      index: true,
    },
  },
  {
    timestamps: true,
    indexes: [
      { repoId: 1, number: 1 },
      { repoId: 1, state: 1 },
      { repoId: 1, createdAt: -1 },
    ],
  }
);

// Compound unique index for repo + PR number
githubPullRequestSchema.index({ repoId: 1, number: 1 }, { unique: true });

module.exports = mongoose.model("GithubPullRequest", githubPullRequestSchema);
