const express = require("express");
const router = express.Router();
const { syncAll } = require("../controllers/sync.controller");
const { authenticateToken } = require("../middleware/auth.middleware");

router.post("/sync", authenticateToken, syncAll);

module.exports = router;
