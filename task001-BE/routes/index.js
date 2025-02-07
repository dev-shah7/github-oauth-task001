const express = require("express");
const router = express.Router();
const passport = require("passport");
const authController = require("../controllers/auth.controller");

router.get("/", (req, res) => {
  res.json({ message: "Welcome to the API" });
});

router.get("/auth/github", passport.authenticate("github", { session: true }));

router.get(
  "/auth/github/callback",
  passport.authenticate("github", {
    failureRedirect: "/login",
    session: true,
  }),
  authController.handleGithubCallback
);

router.get("/auth/status", authController.getIntegrationStatus);
router.delete("/auth/integration", authController.removeIntegration);

module.exports = router;
