const express = require("express");
const router = express.Router();
const db = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

// Dashboard
router.get("/", requireAdmin, async (req, res) => {
  try {
    res.render("dashboard", {
      user: req.session.user,
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).send("Server error");
  }
});

module.exports = router;
