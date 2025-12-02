const express = require("express");
const router = express.Router();
const db = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

// List all milestones
router.get("/", requireAuth, async (req, res) => {
  try {
    const milestones = await db("milestones")
      .select("*")
      .orderBy("milestoneid");
    res.render("milestones/index", {
      milestones,
      user: req.session.user,
    });
  } catch (err) {
    console.error("Fetch milestones error:", err);
    res.status(500).send("Server error");
  }
});

// New milestone form
router.get("/new", requireAdmin, (req, res) => {
  res.render("milestones/new", { error: null, user: req.session.user });
});

// Create milestone
router.post("/new", requireAdmin, async (req, res) => {
  // Add your create logic here
  res.redirect("/milestones");
});

// Assign milestone form
router.get("/assign", requireAdmin, (req, res) => {
  res.render("milestones/assign", { error: null, user: req.session.user });
});

// Assign milestone
router.post("/assign", requireAdmin, async (req, res) => {
  // Add your assign logic here
  res.redirect("/milestones");
});

module.exports = router;
