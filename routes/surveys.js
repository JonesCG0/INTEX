const express = require("express");
const router = express.Router();
const db = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const {
  sanitizeInt,
} = require("../utils/validators");

// List all surveys
router.get("/", requireAuth, async (req, res) => {
  try {
    const sortBy = req.query.sortBy || "surveyid";
    const sortOrder = req.query.sortOrder || "asc";

    const surveys = await db("surveys as s")
      .join("registrations as r", "s.registrationid", "r.registrationid")
      .join("users as u", "r.userid", "u.userid")
      .join(
        "eventoccurrences as eo",
        "r.eventoccurrenceid",
        "eo.eventoccurrenceid"
      )
      .join("eventtemplates as et", "eo.eventtemplateid", "et.eventtemplateid")
      .select("s.*", "u.userfirstname", "u.userlastname", "et.eventname")
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
    const survey = await db("surveys as s")
      .join("registrations as r", "s.registrationid", "r.registrationid")
      .join("eventoccurrences as eo", "r.eventoccurrenceid", "eo.eventoccurrenceid")
      .join("eventtemplates as et", "eo.eventtemplateid", "et.eventtemplateid")
      .select(
        "s.*",
        "et.eventname",
        "et.eventtype",
        "et.eventdescription",
        "eo.eventdatetimestart",
        "eo.eventdatetimeend",
        "eo.eventlocation"
      )
      .where({ "s.surveyid": req.params.id })
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

// Edit survey form - admin only
router.get("/:id/edit", requireAdmin, async (req, res) => {
  try {
    const survey = await db("surveys")
      .select("*")
      .where({ surveyid: req.params.id })
      .first();

    if (!survey) {
      return res.status(404).send("Survey not found");
    }

    res.render("surveys/edit", {
      survey,
      error: null,
      user: req.session.user,
    });
  } catch (err) {
    console.error("Fetch survey for edit error:", err);
    res.status(500).send("Server error");
  }
});

// Update survey - admin only
router.post("/:id/edit", requireAdmin, async (req, res) => {
  const surveyId = req.params.id;

  let existing;
  try {
    existing = await db("surveys").where({ surveyid: surveyId }).first();
  } catch (err) {
    console.error("Fetch survey for update error:", err);
    return res.status(500).send("Server error");
  }

  if (!existing) {
    return res.status(404).send("Survey not found");
  }

  const fields = [
    "surveysatisfactionscore",
    "surveyusefulnessscore",
    "surveyinstructorscore",
    "surveyrecommendationscore",
  ];

  const errors = [];

  const cleaned = {};
  fields.forEach((field) => {
    const raw = req.body[field];
    const value = sanitizeInt(raw, { min: 1, max: 5 });
    if (!value) {
      errors.push("All scores must be between 1 and 5");
    }
    cleaned[field] = value;
  });

  if (errors.length) {
    return res.status(400).render("surveys/edit", {
      survey: { ...existing, ...req.body },
      error: errors[0],
      user: req.session.user,
    });
  }

  const surveyoverallscore =
    (cleaned.surveysatisfactionscore +
      cleaned.surveyusefulnessscore +
      cleaned.surveyinstructorscore +
      cleaned.surveyrecommendationscore) /
    4;

  try {
    await db("surveys").where({ surveyid: surveyId }).update({
      ...cleaned,
      surveyoverallscore,
    });
    res.redirect(`/surveys/${surveyId}`);
  } catch (err) {
    console.error("Update survey error:", err);
    res.status(500).render("surveys/edit", {
      survey: { ...existing, ...req.body },
      error: "Unable to update survey",
      user: req.session.user,
    });
  }
});

// Delete survey - admin only
router.post("/:id/delete", requireAdmin, async (req, res) => {
  const surveyId = req.params.id;

  try {
    await db.transaction(async (trx) => {
      // Delete dependent comments first to satisfy FK constraint
      await trx("surveycomments").where({ surveyid: surveyId }).del();
      await trx("surveys").where({ surveyid: surveyId }).del();
    });

    res.redirect("/surveys");
  } catch (err) {
    console.error("Delete survey error:", err);
    res.status(500).send("Server error");
  }
});

module.exports = router;
