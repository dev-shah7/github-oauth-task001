const passport = require("passport");
const GitHubStrategy = require("passport-github2").Strategy;
const GitHubIntegration = require("../models/GitHubIntegration");
const { encrypt, decrypt } = require("../utils/encryption");
require("dotenv").config();

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const dummyUser = {
      id: id,
      username: "dummyUser",
    };
    done(null, dummyUser);
  } catch (err) {
    done(err, null);
  }
});

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL:
        process.env.GITHUB_CALLBACK_URL ||
        "http://localhost:3000/api/auth/github/callback",
      scope: ["user", "repo", "read:org"],
    },
    async function (accessToken, refreshToken, profile, done) {
      try {
        let integration = await GitHubIntegration.findOne({
          githubId: profile.id,
        });

        const integrationData = {
          githubId: profile.id,
          username: profile.username,
          avatarUrl: profile.photos?.[0]?.value,
          email: profile.emails?.[0]?.value,
          accessToken: encrypt(accessToken),
          refreshToken: refreshToken ? encrypt(refreshToken) : null,
          profile: {
            name: profile._json.name,
            bio: profile._json.bio,
            location: profile._json.location,
            company: profile._json.company,
            blog: profile._json.blog,
            publicRepos: profile._json.public_repos,
            followers: profile._json.followers,
            following: profile._json.following,
          },
          lastUpdated: new Date(),
        };

        if (integration) {
          integration = await GitHubIntegration.findOneAndUpdate(
            { githubId: profile.id },
            integrationData,
            { new: true }
          );
        } else {
          integration = await GitHubIntegration.create(integrationData);
        }

        const user = {
          id: profile.id,
          username: profile.username,
          displayName: profile.displayName || profile.username,
          accessToken: accessToken,
          refreshToken: refreshToken,
        };

        return done(null, user);
      } catch (err) {
        console.error("Error in GitHub strategy:", err);
        return done(err, null);
      }
    }
  )
);

module.exports = passport;
