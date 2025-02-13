const express = require("express");
const router = express.Router();
const integrationController = require("../controllers/integration.controller");
const relationshipsController = require("../controllers/relationships.controller");
router.get("/", integrationController.getIntegrations);
router.get(
  "/github/organizations",
  integrationController.getGithubOrganizations
);
router.get(
  "/github/organizations/:orgId/:dataType",
  integrationController.getOrganizationData
);
router.post(
  "/github/organizations/:orgId/repo/:dataType",
  integrationController.getRepositoryData
);
router.get("/github/user/repos", integrationController.getUserRepos);
router.post("/github/user/repo/:type", integrationController.getUserRepoData);
router.get(
  "/repository/relationships",
  relationshipsController.getRepositoryRelationships
);
router.get("/github/repos", integrationController.getStoredRepos);
router.get(
  "/github/repos/:owner/:repo/issues/:issueNumber/details",
  integrationController.getIssueDetails
);
router.get(
  "/github/repos/:owner/:repo/pulls/:prNumber/details",
  integrationController.getPRDetails
);
router.get(
  "/github/repos/:owner/:repo/commits/:sha/details",
  integrationController.getCommitDetails
);

module.exports = router;
