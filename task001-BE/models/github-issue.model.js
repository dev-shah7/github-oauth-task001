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
  state: {
    type: String,
    index: true,
  },
  user: {
    login: String,
    id: Number,
    avatarUrl: String,
    url: String,
    htmlUrl: String,
  },
  body: String,
  createdAt: {
    type: Date,
    index: true,
  },
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
      url: String,
      htmlUrl: String,
    },
  ],
  milestone: {
    title: String,
    state: String,
    dueOn: Date,
    number: Number,
  },
  comments: Number,
  isPullRequest: Boolean,
  locked: Boolean,
  activeLockReason: String,
  authorAssociation: String,
  githubIntegrationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "GitHubIntegration",
    required: true,
  },
  pageInfo: {
    page: Number,
    pageSize: Number,
    fetchedAt: {
      type: Date,
      default: Date.now,
    },
  },
});

githubIssueSchema.index({ repoId: 1, number: 1 }, { unique: true });
githubIssueSchema.index({ createdAt: -1 });
githubIssueSchema.index({ state: 1 });

module.exports = mongoose.model("GithubIssue", githubIssueSchema);
