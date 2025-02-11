const mongoose = require("mongoose");

const githubIssueSchema = new mongoose.Schema({
  repoId: {
    type: String,
    required: true,
  },
  orgId: String,
  number: {
    type: Number,
    required: true,
  },
  title: String,
  state: String,
  user: {
    login: String,
    id: Number,
    avatarUrl: String,
  },
  body: String,
  createdAt: Date,
  updatedAt: Date,
  closedAt: Date,
  labels: [
    {
      id: Number,
      name: String,
      color: String,
      description: String,
    },
  ],
  assignees: [
    {
      login: String,
      id: Number,
      avatarUrl: String,
    },
  ],
  comments: Number,
  url: String,
  htmlUrl: String,
  githubIntegrationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "GitHubIntegration",
    required: true,
  },
});

githubIssueSchema.index({ repoId: 1, number: 1 }, { unique: true });

module.exports = mongoose.model("GithubIssue", githubIssueSchema);
