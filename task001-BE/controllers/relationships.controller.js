const mongoose = require("mongoose");
const GitHubIntegration = require("../models/github-integration.model");
const GithubRepository = require("../models/github-repository.model");

async function fetchRepositoryRelationships(
  integration,
  repository,
  page = 1,
  pageSize = 20,
  filters = {}
) {
  try {
    const GithubCommit = mongoose.model("GithubCommit");
    const GithubPullRequest = mongoose.model("GithubPullRequest");
    const GithubIssue = mongoose.model("GithubIssue");

    const matchConditions = {
      repoId: repository.repoId.toString(),
      githubIntegrationId: integration._id,
    };

    if (filters.startDate && filters.endDate) {
      matchConditions["commit.author.date"] = {
        $gte: new Date(filters.startDate),
        $lte: new Date(filters.endDate),
      };
    }

    const commitsAggregation = [
      { $match: matchConditions },
      { $sort: { "commit.author.date": -1 } },
      { $skip: (page - 1) * pageSize },
      {
        $project: {
          sha: 1,
          commit: 1,
          author: 1,
          committer: 1,
          html_url: 1,
          url: 1,
        },
      },
    ];

    const prMatchConditions = {
      repoId: repository.repoId.toString(),
      githubIntegrationId: integration._id,
    };

    if (filters.state) {
      prMatchConditions.state = filters.state;
    }

    const prsAggregation = [
      { $match: prMatchConditions },
      { $sort: { createdAt: -1 } },
      { $skip: (page - 1) * pageSize },
      {
        $project: {
          _id: 1,
          number: 1,
          title: 1,
          state: 1,
          user: 1,
          body: 1,
          createdAt: 1,
          updatedAt: 1,
          closedAt: 1,
          mergedAt: 1,
          url: 1,
          html_url: 1,
        },
      },
    ];

    const issueMatchConditions = {
      repoId: repository.repoId.toString(),
      githubIntegrationId: integration._id,
      isPullRequest: { $ne: true },
    };

    if (filters.state) {
      issueMatchConditions.state = filters.state;
    }

    const issuesAggregation = [
      { $match: issueMatchConditions },
      { $sort: { createdAt: -1 } },
      { $skip: (page - 1) * pageSize },
      {
        $project: {
          _id: 1,
          number: 1,
          title: 1,
          state: 1,
          user: 1,
          body: 1,
          createdAt: 1,
          updatedAt: 1,
          closedAt: 1,
          labels: 1,
          assignees: 1,
          comments: 1,
          html_url: 1,
          url: 1,
        },
      },
    ];

    const [commits, pullRequests, issues, commitCount, prCount, issueCount] =
      await Promise.all([
        GithubCommit.aggregate(commitsAggregation),
        GithubPullRequest.aggregate(prsAggregation),
        GithubIssue.aggregate(issuesAggregation),
        GithubCommit.countDocuments(matchConditions),
        GithubPullRequest.countDocuments(prMatchConditions),
        GithubIssue.countDocuments(issueMatchConditions),
      ]);

    console.log("Match conditions:", matchConditions);
    console.log("Commit count:", commitCount);
    console.log("Commits found:", commits.length);
    console.log("PR count:", prCount);
    console.log("PRs found:", pullRequests.length);
    console.log("Issue count:", issueCount);
    console.log("Issues found:", issues.length);

    return {
      repository: {
        name: repository.name,
        fullName: repository.fullName,
        description: repository.description,
        updatedAt: repository.updatedAt,
      },
      relationships: {
        commits: {
          data: commits,
          totalCount: commitCount,
        },
        pullRequests: {
          data: pullRequests,
          totalCount: prCount,
        },
        issues: {
          data: issues,
          totalCount: issueCount,
        },
      },
      pagination: {
        currentPage: page,
        pageSize: pageSize,
        totalPages: Math.ceil(
          Math.max(commitCount, prCount, issueCount) / pageSize
        ),
      },
    };
  } catch (error) {
    console.error("Error in fetchRepositoryRelationships:", error);
    throw error;
  }
}

exports.getRepositoryRelationships = async (req, res) => {
  try {
    const {
      owner,
      repo: repoName,
      page = 1,
      pageSize = 20,
      state,
      startDate,
      endDate,
    } = req.query;

    const user = req.user || req.session?.user;

    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const integration = await GitHubIntegration.findOne({
      githubId: user.githubId,
    });

    if (!integration) {
      return res.status(404).json({ error: "GitHub integration not found" });
    }

    const repository = await GithubRepository.findOne({
      name: repoName,
      "owner.login": owner,
    });

    if (!repository) {
      return res.status(404).json({ error: "Repository not found" });
    }

    const filters = {
      state,
      startDate,
      endDate,
    };

    const relationships = await fetchRepositoryRelationships(
      integration,
      repository,
      parseInt(page),
      parseInt(pageSize),
      filters
    );

    return res.json(relationships);
  } catch (error) {
    console.error("Error fetching repository relationships:", error);
    res.status(500).json({
      error: "Failed to fetch repository relationships",
      details: error.message,
    });
  }
};
