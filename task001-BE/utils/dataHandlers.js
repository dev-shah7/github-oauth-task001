const GithubCommit = require("../models/github-commit.model");
const GithubPullRequest = require("../models/github-pull-request.model");

const handleCommits = async (data, integration, repoId, orgId = null) => {
  return Promise.all(
    data.map(async (commit) => {
      const commitData = {
        repoId,
        sha: commit.sha,
        commit: {
          author: commit.commit.author,
          message: commit.commit.message,
        },
        author: commit.author && {
          login: commit.author.login,
          id: commit.author.id,
          avatarUrl: commit.author.avatar_url,
        },
        url: commit.url,
        htmlUrl: commit.html_url,
        githubIntegrationId: integration._id,
        ...(orgId && { orgId }),
      };

      return GithubCommit.findOneAndUpdate(
        { sha: commitData.sha },
        commitData,
        { upsert: true, new: true }
      );
    })
  );
};

const handlePulls = async (data, integration, repoId, orgId = null) => {
  return Promise.all(
    data.map(async (pr) => {
      const prData = {
        repoId,
        number: pr.number,
        title: pr.title,
        state: pr.state,
        user: {
          login: pr.user.login,
          id: pr.user.id,
          avatarUrl: pr.user.avatar_url,
        },
        body: pr.body,
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        closedAt: pr.closed_at,
        mergedAt: pr.merged_at,
        url: pr.url,
        htmlUrl: pr.html_url,
        githubIntegrationId: integration._id,
        ...(orgId && { orgId }),
      };

      return GithubPullRequest.findOneAndUpdate(
        {
          repoId: prData.repoId,
          number: prData.number,
        },
        prData,
        { upsert: true, new: true }
      );
    })
  );
};

const handleIssues = (data) => {
  return data.map((issue) => ({
    number: issue.number,
    title: issue.title,
    state: issue.state,
    user: {
      login: issue.user.login,
      id: issue.user.id,
      avatarUrl: issue.user.avatar_url,
    },
    body: issue.body,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    closedAt: issue.closed_at,
    labels: issue.labels,
    assignees: issue.assignees,
    comments: issue.comments,
    url: issue.url,
    htmlUrl: issue.html_url,
  }));
};

module.exports = {
  handleCommits,
  handlePulls,
  handleIssues,
};
