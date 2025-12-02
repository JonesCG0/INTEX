const express = require("express");
const router = express.Router();
const db = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

// List all surveys
router.get("/", requireAuth, async (req, res) => {
  try {
    const sortBy = req.query.sortBy || "surveyid";
    const sortOrder = req.query.sortOrder || "asc";

    const surveys = await db("surveys").select("*").orderBy(sortBy, sortOrder);
    res.render("surveys/index", {
      surveys,
      user: req.session.user,
      sortBy,
      sortOrder,
    });
  } catch (err) {
    console.error("Fetch surveys error:", err);
    res.status(500).send("Server error");
  }
});

// New survey form
router.get("/new", requireAdmin, (req, res) => {
  res.render("surveys/new", { error: null, user: req.session.user });
});

// Create survey
router.post("/new", requireAdmin, async (req, res) => {
  // Add your create logic here
  res.redirect("/surveys");
});

// Show single survey
router.get("/:id", requireAdmin, async (req, res) => {
  try {
    const survey = await db("surveys")
      .select("*")
      .where({ surveyid: req.params.id })
      .first();

    if (!survey) {
      return res.status(404).send("Survey not found");
    }

    res.render("surveys/show", {
      survey,
      user: req.session.user,
    });
  } catch (err) {
    console.error("Fetch survey error:", err);
    res.status(500).send("Server error");
  }
});

module.exports = router;
