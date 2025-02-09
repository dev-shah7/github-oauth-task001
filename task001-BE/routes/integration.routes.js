const express = require("express");
const router = express.Router();
const integrationController = require("../controllers/integration.controller");

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

module.exports = router;
