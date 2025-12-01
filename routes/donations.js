const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

// List all donations
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM donations ORDER BY donationid"
    );
    res.render("donations/index", {
      donations: result.rows,
      user: req.session.user,
    });
  } catch (err) {
    console.error("Fetch donations error:", err);
    res.status(500).send("Server error");
  }
});

// New donation form
router.get("/new", requireAuth, (req, res) => {
  res.render("donations/new", { error: null, user: req.session.user });
});

// Create donation
router.post("/new", requireAuth, async (req, res) => {
  // Add your create logic here
  res.redirect("/donations");
});

module.exports = router;
