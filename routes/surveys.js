const express = require("express");
const router = express.Router();
const db = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const {
  hasText,
  sanitizeISODate,
  sanitizeInt,
} = require("../utils/validators");

function parseScore(value, label, errors) {
  if (!hasText(value)) {
    return null;
  }
  const numeric = sanitizeInt(value, { min: 1, max: 10 });
  if (!numeric) {
    errors.push(`${label} must be a number between 1 and 10`);
  }
  return numeric;
}

// List all surveys
router.get("/", requireAuth, async (req, res) => {
  try {
    const sortBy = req.query.sortBy || "surveyid";
    const sortOrder = req.query.sortOrder || "asc";

    const surveys = await db("surveys as s")
      .join("registrations as r", "s.registrationid", "r.registrationid")
      .join("users as u", "r.userid", "u.userid")
      .join("eventoccurrences as eo", "r.eventoccurrenceid", "eo.eventoccurrenceid")
      .join("eventtemplates as et", "eo.eventtemplateid", "et.eventtemplateid")
      .select(
        "s.*",
        "u.userfirstname",
        "u.userlastname",
        "et.eventname"
      )
      .orderBy(sortBy === "surveyid" ? "s.surveyid" : `s.${sortBy}`, sortOrder);

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
