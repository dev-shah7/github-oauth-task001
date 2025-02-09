const mongoose = require("mongoose");

const githubCommitSchema = new mongoose.Schema(
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
    sha: {
      type: String,
      required: true,
      unique: true,
    },
    commit: {
      author: {
        name: String,
        email: String,
        date: Date,
      },
      message: String,
    },
    author: {
      login: String,
      id: Number,
      avatarUrl: String,
    },
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
      { repoId: 1, sha: 1 },
      { repoId: 1, "commit.author.date": -1 },
    ],
  }
);

module.exports = mongoose.model("GithubCommit", githubCommitSchema);
