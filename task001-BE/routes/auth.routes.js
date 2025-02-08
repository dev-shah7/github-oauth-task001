const express = require("express");
const router = express.Router();
const passport = require("passport");
const authController = require("../controllers/auth.controller");

router.get("/github", passport.authenticate("github", { session: true }));

router.get(
  "/github/callback",
  passport.authenticate("github", {
    failureRedirect: "/login",
    session: true,
  }),
  authController.handleGithubCallback
);

router.get("/status", authController.getIntegrationStatus);
router.delete("/integration", authController.removeIntegration);

module.exports = router;
