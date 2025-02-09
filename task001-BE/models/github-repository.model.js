const mongoose = require("mongoose");

const githubRepositorySchema = new mongoose.Schema(
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
      unique: true,
    },
    name: { type: String, required: true },
    fullName: { type: String },
    owner: {
      login: String,
      id: Number,
      avatarUrl: String,
    },
    private: Boolean,
    description: String,
    url: String,
    htmlUrl: String,
    createdAt: Date,
    updatedAt: Date,
    githubIntegrationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GitHubIntegration",
      index: true,
    },
  },
  {
    timestamps: true,
    indexes: [
      { orgId: 1, name: 1 },
      { repoId: 1, orgId: 1 },
    ],
  }
);

module.exports = mongoose.model("GithubRepository", githubRepositorySchema);
