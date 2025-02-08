const express = require("express");
const router = express.Router();
const integrationRoutes = require("./integration.routes");
const authRoutes = require("./auth.routes");

router.use("/integrations", integrationRoutes);
router.use("/auth", authRoutes);

router.get("/", (req, res) => {
  res.json({ message: "Welcome to the API" });
});

module.exports = router;
