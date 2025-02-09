const mongoose = require("mongoose");

const githubOrganizationSchema = new mongoose.Schema(
  {
    orgId: { type: String, required: true, unique: true },
    login: { type: String, required: true },
    name: String,
    avatarUrl: String,
    description: String,
    url: String,
    reposUrl: String,
    eventsUrl: String,
    hooksUrl: String,
    issuesUrl: String,
    membersUrl: String,
    publicMembersUrl: String,
    githubIntegrationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GithubIntegration",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("GithubOrganization", githubOrganizationSchema);
