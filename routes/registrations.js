const express = require("express");
const router = express.Router();
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

// List all registrations for the current user
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.userid;

    const registrations = await db("registrations as r")
      .join(
        "eventoccurrences as eo",
        "r.eventoccurrenceid",
        "eo.eventoccurrenceid"
      )
      .join("eventtemplates as et", "eo.eventtemplateid", "et.eventtemplateid")
      .leftJoin("surveys as s", "r.registrationid", "s.registrationid")
      .select(
        "r.registrationid",
        "r.registrationcreatedat",
        "r.registrationstatus",
        "r.registrationattendedflag",
        "r.registrationcheckintime",
        "et.eventname",
        "et.eventtype",
        "et.eventdescription",
        "eo.eventoccurrenceid",
        "eo.eventdatetimestart",
        "eo.eventdatetimeend",
        "eo.eventlocation",
        "eo.eventcapacity",
        "s.surveyid"
      )
      .where("r.userid", userId)
      .orderBy("eo.eventdatetimestart", "desc");

    res.render("registrations/index", {
      registrations,
      user: req.session.user,
    });
  } catch (err) {
    console.error("Fetch registrations error:", err);
    res.status(500).send("Server error");
  }
});

// Survey form for a specific registration
router.get("/:id/survey", requireAuth, async (req, res) => {
  try {
    const registrationId = req.params.id;
    const userId = req.session.user.userid;

    // Fetch the registration with event details
    const registration = await db("registrations as r")
      .join(
        "eventoccurrences as eo",
        "r.eventoccurrenceid",
        "eo.eventoccurrenceid"
      )
      .join("eventtemplates as et", "eo.eventtemplateid", "et.eventtemplateid")
      .leftJoin("surveys as s", "r.registrationid", "s.registrationid")
      .select(
        "r.registrationid",
        "r.userid",
        "r.registrationattendedflag",
        "et.eventname",
        "et.eventdescription",
        "eo.eventdatetimestart",
        "eo.eventdatetimeend",
        "s.surveyid"
      )
      .where("r.registrationid", registrationId)
      .first();

    // Verify registration exists and belongs to user
    if (!registration) {
      return res.status(404).send("Registration not found");
    }

    if (registration.userid !== userId) {
      return res.status(403).send("Unauthorized");
    }

    // Verify user can submit survey
    const hasAttended = registration.registrationattendedflag == 1;
    const eventEnded =
      registration.eventdatetimeend &&
      new Date(registration.eventdatetimeend) < new Date();
    const noSurvey = !registration.surveyid;

    if (!hasAttended || !eventEnded || !noSurvey) {
      return res
        .status(400)
        .send("You cannot submit a survey for this registration");
    }

    res.render("registrations/survey", {
      registration,
      error: null,
      user: req.session.user,
    });
  } catch (err) {
    console.error("Fetch registration error:", err);
    res.status(500).send("Server error");
  }
});

// Submit survey for a registration
router.post("/:id/survey", requireAuth, async (req, res) => {
  try {
    const registrationId = req.params.id;
    const userId = req.session.user.userid;

    const {
      surveysatisfactionscore,
      surveyusefulnessscore,
      surveyinstructorscore,
      surveyrecommendationscore,
    } = req.body;

    // Parse scores as integers first
    const satisfaction = parseInt(surveysatisfactionscore);
    const usefulness = parseInt(surveyusefulnessscore);
    const instructor = parseInt(surveyinstructorscore);
    const recommendation = parseInt(surveyrecommendationscore);

    // Calculate overall score as average
    const surveyoverallscore = (satisfaction + usefulness + instructor + recommendation) / 4;

    // Fetch the registration to verify ownership and eligibility
    const registration = await db("registrations as r")
      .join(
        "eventoccurrences as eo",
        "r.eventoccurrenceid",
        "eo.eventoccurrenceid"
      )
      .join("eventtemplates as et", "eo.eventtemplateid", "et.eventtemplateid")
      .leftJoin("surveys as s", "r.registrationid", "s.registrationid")
      .select(
        "r.registrationid",
        "r.userid",
        "r.registrationattendedflag",
        "et.eventname",
        "et.eventdescription",
        "eo.eventdatetimestart",
        "eo.eventdatetimeend",
        "s.surveyid"
      )
      .where("r.registrationid", registrationId)
      .first();

    if (!registration || registration.userid !== userId) {
      return res.status(403).send("Unauthorized");
    }

    const hasAttended = registration.registrationattendedflag == 1;
    const eventEnded =
      registration.eventdatetimeend &&
      new Date(registration.eventdatetimeend) < new Date();
    const noSurvey = !registration.surveyid;

    if (!hasAttended || !eventEnded || !noSurvey) {
      return res.status(400).render("registrations/survey", {
        registration,
        error: "You cannot submit a survey for this registration",
        user: req.session.user,
      });
    }

    // Validate scores (1-5)
    const scores = [satisfaction, usefulness, instructor, recommendation];

    for (const score of scores) {
      if (!score || isNaN(score) || score < 1 || score > 5) {
        return res.status(400).render("registrations/survey", {
          registration,
          error: "All scores must be between 1 and 5",
          user: req.session.user,
        });
      }
    }

    // Insert survey
    await db("surveys").insert({
      registrationid: registrationId,
      surveysatisfactionscore: satisfaction,
      surveyusefulnessscore: usefulness,
      surveyinstructorscore: instructor,
      surveyrecommendationscore: recommendation,
      surveyoverallscore: surveyoverallscore,
      surveysubmissiondate: new Date().toISOString().split("T")[0],
    });

    res.redirect("/registrations");
  } catch (err) {
    console.error("Submit survey error:", err);
    res.status(500).send("Server error");
  }
});

module.exports = router;
