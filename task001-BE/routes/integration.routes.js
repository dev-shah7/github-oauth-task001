const express = require("express");
const router = express.Router();
const integrationController = require("../controllers/integration.controller");

router.get("/", integrationController.getIntegrations);
router.get(
  "/github/organizations",
  integrationController.getGithubOrganizations
);

module.exports = router;
