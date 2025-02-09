const mongoose = require("mongoose");
const { encrypt, decrypt } = require("../utils/encryption");

const githubIntegrationSchema = new mongoose.Schema(
  {
    githubId: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    avatarUrl: { type: String, required: false },
    email: { type: String },
    accessToken: { type: String, required: true },
    refreshToken: String,
    profile: { type: Object },
    lastUpdated: Date,
    connectionDate: { type: Date },
    lastLogin: { type: Date },
    lastSynced: { type: Date, default: Date.now },
  },
  { collection: "github-integration" }
);

githubIntegrationSchema.pre("save", function (next) {
  if (this.isModified("accessToken")) {
    this.accessToken = encrypt(this.accessToken);
  }
  next();
});

githubIntegrationSchema.methods.getDecryptedAccessToken = function () {
  return decrypt(this.accessToken);
};

module.exports = mongoose.model("GithubIntegration", githubIntegrationSchema);
