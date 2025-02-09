const passport = require("passport");
const GitHubStrategy = require("passport-github2").Strategy;
const GitHubIntegration = require("../models/github-integration.model");
const { encrypt, decrypt } = require("../utils/encryption");
require("dotenv").config();

passport.serializeUser((user, done) => {
  done(null, user.githubId);
});

passport.deserializeUser(async (githubId, done) => {
  try {
    const user = await GitHubIntegration.findOne({ githubId });
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/api/auth/github/callback",
      scope: ["read:org", "user", "repo", "write:org"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await GitHubIntegration.findOne({ githubId: profile.id });

        if (!user) {
          user = new GitHubIntegration({
            githubId: profile.id,
            username: profile.username,
            email: profile.emails?.[0]?.value,
            avatarUrl: profile.photos?.[0]?.value,
            accessToken,
            profile: profile._json,
            connectionDate: new Date(),
          });

          await user.save();
        } else {
          user.accessToken = accessToken;
          user.lastLogin = new Date();
          await user.save();
        }

        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

module.exports = passport;
