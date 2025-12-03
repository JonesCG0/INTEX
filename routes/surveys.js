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
  const {
    surveysatisfactionscore,
    surveyusefulnessscore,
    surveyinstructorscore,
    surveyrecommendationscore,
    surveyoverallscore,
    surveysubmissiondate,
    registrationid,
  } = req.body;

  const errors = [];

  const payload = {
    registrationid: sanitizeInt(registrationid, { min: 1 }),
    surveysubmissiondate: sanitizeISODate(surveysubmissiondate),
    surveysatisfactionscore: null,
    surveyusefulnessscore: null,
    surveyinstructorscore: null,
    surveyrecommendationscore: null,
    surveyoverallscore: null,
  };

  if (!payload.registrationid) {
    errors.push("Registration ID must be a positive whole number");
  }
  if (!payload.surveysubmissiondate) {
    errors.push("Submission date must be a valid YYYY-MM-DD value");
  }

  payload.surveysatisfactionscore = parseScore(
    surveysatisfactionscore,
    "Satisfaction score",
    errors
  );
  payload.surveyusefulnessscore = parseScore(
    surveyusefulnessscore,
    "Usefulness score",
    errors
  );
  payload.surveyinstructorscore = parseScore(
    surveyinstructorscore,
    "Instructor score",
    errors
  );
  payload.surveyrecommendationscore = parseScore(
    surveyrecommendationscore,
    "Recommendation score",
    errors
  );
  payload.surveyoverallscore = parseScore(
    surveyoverallscore,
    "Overall score",
    errors
  );

  if (errors.length) {
    return res.status(400).render("surveys/new", {
      error: errors[0],
      user: req.session.user,
    });
  }

  try {
    const [created] = await db("surveys").insert(payload).returning("surveyid");
    res.redirect(`/surveys/${created.surveyid}`);
  } catch (err) {
    console.error("Create survey error:", err);
    res
      .status(500)
      .render("surveys/new", { error: "Server error", user: req.session.user });
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
