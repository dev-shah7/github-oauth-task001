const GithubCommit = require("../models/github-commit.model");
const GithubPullRequest = require("../models/github-pull-request.model");
const GithubIssue = require("../models/github-issue.model");

const handleCommits = async (
  data,
  integration,
  repoId,
  orgId = null,
  page = 1,
  pageSize = 100
) => {
  try {
    if (!repoId) {
      throw new Error("Repository ID is required");
    }

    const commits = data.map((commit) => ({
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
      pageInfo: {
        page,
        pageSize,
        fetchedAt: new Date(),
      },
    }));

    const bulkOps = commits.map((commit) => ({
      updateOne: {
        filter: { repoId: commit.repoId, sha: commit.sha },
        update: { $set: commit },
        upsert: true,
      },
    }));

    if (bulkOps.length > 0) {
      await GithubCommit.bulkWrite(bulkOps);
    }
    return commits;
  } catch (error) {
    console.error("Error handling commits:", error);
    throw error;
  }
};

const handlePulls = async (
  data,
  integration,
  repoId,
  orgId = null,
  page = 1,
  pageSize = 100
) => {
  try {
    if (!repoId) {
      throw new Error("Repository ID is required");
    }

    const pulls = data.map((pr) => ({
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
      pageInfo: {
        page,
        pageSize,
        fetchedAt: new Date(),
      },
    }));

    const bulkOps = pulls.map((pull) => ({
      updateOne: {
        filter: { repoId: pull.repoId, number: pull.number },
        update: { $set: pull },
        upsert: true,
      },
    }));

    if (bulkOps.length > 0) {
      await GithubPullRequest.bulkWrite(bulkOps);
    }
    return pulls;
  } catch (error) {
    console.error("Error handling pull requests:", error);
    throw error;
  }
};

const handleIssues = async (
  data,
  integration,
  repoId,
  orgId = null,
  page = 1,
  pageSize = 100
) => {
  try {
    if (!repoId) {
      throw new Error("Repository ID is required");
    }

    const issues = data
      .filter((issue) => !issue.pull_request)
      .map((issue) => ({
        repoId,
        number: issue.number,
        title: issue.title || "",
        state: issue.state,
        user: issue.user
          ? {
              login: issue.user.login,
              id: issue.user.id,
              avatarUrl: issue.user.avatar_url,
            }
          : null,
        body: issue.body || "",
        createdAt: issue.created_at ? new Date(issue.created_at) : null,
        updatedAt: issue.updated_at ? new Date(issue.updated_at) : null,
        closedAt: issue.closed_at ? new Date(issue.closed_at) : null,
        labels: Array.isArray(issue.labels)
          ? issue.labels.map((label) => ({
              id: label.id,
              name: label.name || "",
              color: label.color || "",
              description: label.description || "",
            }))
          : [],
        assignees: Array.isArray(issue.assignees)
          ? issue.assignees.map((assignee) => ({
              login: assignee.login,
              id: assignee.id,
              avatarUrl: assignee.avatar_url,
            }))
          : [],
        comments: issue.comments || 0,
        url: issue.url,
        htmlUrl: issue.html_url,
        githubIntegrationId: integration._id,
        ...(orgId && { orgId }),
        pageInfo: {
          page,
          pageSize,
          fetchedAt: new Date(),
        },
      }));

    if (issues.length > 0) {
      const bulkOps = issues.map((issue) => ({
        updateOne: {
          filter: { repoId: issue.repoId, number: issue.number },
          update: { $set: issue },
          upsert: true,
        },
      }));

      await GithubIssue.bulkWrite(bulkOps);
    }

    return issues;
  } catch (error) {
    console.error("Error handling issues:", error);
    throw error;
  }
};

module.exports = {
  handleCommits,
  handlePulls,
  handleIssues,
};
