const express = require("express");
const router = express.Router();
const db = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

// Show available future events for registration
router.get("/register", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.userid;
    const now = new Date();

    // Fetch future events that are still accepting registrations
    const events = await db("eventoccurrences as eo")
      .join("eventtemplates as et", "eo.eventtemplateid", "et.eventtemplateid")
      .leftJoin("registrations as r", function() {
        this.on("r.eventoccurrenceid", "=", "eo.eventoccurrenceid")
            .andOn("r.userid", "=", db.raw("?", [userId]));
      })
      .select(
        "eo.eventoccurrenceid",
        "et.eventname",
        "et.eventtype",
        "et.eventdescription",
        "eo.eventdatetimestart",
        "eo.eventdatetimeend",
        "eo.eventlocation",
        "eo.eventcapacity",
        "eo.eventregistrationdeadline",
        "r.registrationid"
      )
      .where("eo.eventdatetimestart", ">", now)
      .orderBy("eo.eventdatetimestart", "asc");

    // Get current registration counts for each event
    const registrationCounts = await db("registrations")
      .select("eventoccurrenceid")
      .count("* as count")
      .groupBy("eventoccurrenceid");

    const countMap = {};
    registrationCounts.forEach(r => {
      countMap[r.eventoccurrenceid] = parseInt(r.count);
    });

    // Add registration counts and status to events
    events.forEach(event => {
      event.currentRegistrations = countMap[event.eventoccurrenceid] || 0;
      event.isRegistered = !!event.registrationid;
      event.isFull = event.eventcapacity && event.currentRegistrations >= event.eventcapacity;
      event.registrationClosed = event.eventregistrationdeadline && new Date(event.eventregistrationdeadline) < now;
    });

    let successMessage = null;
    if (req.query.success === "registered") {
      successMessage = "Successfully registered for the event!";
    } else if (req.query.success === "unregistered") {
      successMessage = "You have been unregistered from the event.";
    }

    res.render("registrations/register", {
      events,
      user: req.session.user,
      error: req.query.error || null,
      success: successMessage,
    });
  } catch (err) {
    console.error("Fetch events error:", err);
    res.status(500).send("Server error");
  }
});

// Register current user for an event
router.post("/register/:eventId", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.userid;
    const eventId = req.params.eventId;

    // Check if event exists and is in the future
    const event = await db("eventoccurrences")
      .select("*")
      .where("eventoccurrenceid", eventId)
      .first();

    if (!event) {
      return res.status(404).send("Event not found");
    }

    if (new Date(event.eventdatetimestart) <= new Date()) {
      return res.status(400).send("Cannot register for past events");
    }

    // Check if registration deadline has passed
    if (event.eventregistrationdeadline && new Date(event.eventregistrationdeadline) < new Date()) {
      return res.status(400).send("Registration deadline has passed");
    }

    // Check if event is full
    if (event.eventcapacity) {
      const registrationCount = await db("registrations")
        .where("eventoccurrenceid", eventId)
        .count("* as count")
        .first();

      if (parseInt(registrationCount.count) >= event.eventcapacity) {
        return res.status(400).send("Event is full");
      }
    }

    // Check if user is already registered
    const existingRegistration = await db("registrations")
      .where({ userid: userId, eventoccurrenceid: eventId })
      .first();

    if (existingRegistration) {
      return res.status(400).send("You are already registered for this event");
    }

    // Create registration
    await db("registrations").insert({
      userid: userId,
      eventoccurrenceid: eventId,
      registrationstatus: "Confirmed",
      registrationcreatedat: new Date(),
      registrationattendedflag: 0,
    });

    res.redirect("/registrations/register?success=registered");
  } catch (err) {
    console.error("Register for event error:", err);
    res.status(500).send("Server error");
  }
});

// Unregister current user (or admin) from an event
router.post("/:id/unregister", requireAuth, async (req, res) => {
  const registrationId = req.params.id;
  const allowedRedirects = ["/registrations", "/registrations/register"];
  const redirectTo = allowedRedirects.includes(req.body.redirectTo)
    ? req.body.redirectTo
    : "/registrations";
  const redirectWithMessage = (type, value) =>
    `${redirectTo}?${type}=${encodeURIComponent(value)}`;

  try {
    const registration = await db("registrations as r")
      .join(
        "eventoccurrences as eo",
        "r.eventoccurrenceid",
        "eo.eventoccurrenceid"
      )
      .select("r.registrationid", "r.userid", "eo.eventdatetimestart")
      .where("r.registrationid", registrationId)
      .first();

    if (!registration) {
      return res.redirect(redirectWithMessage("error", "Registration not found."));
    }

    const isOwner = registration.userid === req.session.user.userid;
    const isAdmin = req.session.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).send("Unauthorized");
    }

    if (
      registration.eventdatetimestart &&
      new Date(registration.eventdatetimestart) <= new Date()
    ) {
      return res.redirect(
        redirectWithMessage(
          "error",
          "You cannot unregister from an event that has already started."
        )
      );
    }

    await db("registrations").where({ registrationid: registrationId }).del();

    return res.redirect(redirectWithMessage("success", "unregistered"));
  } catch (err) {
    console.error("Unregister from event error:", err);
    return res.redirect(
      redirectWithMessage("error", "Unable to unregister from the event.")
    );
  }
});

// Admin: Search for users (autocomplete)
router.get("/admin/search-users", requireAdmin, async (req, res) => {
  try {
    const query = req.query.q || '';

    if (query.length < 1) {
      return res.json([]);
    }

    // Search by ID or name (case insensitive)
    const users = await db("users")
      .select(
        "users.userid",
        "users.userfirstname",
        "users.userlastname",
        "users.username"
      )
      .where(function() {
        this.where(db.raw("CAST(users.userid AS TEXT)"), "ilike", `%${query}%`)
            .orWhere("users.userfirstname", "ilike", `%${query}%`)
            .orWhere("users.userlastname", "ilike", `%${query}%`)
            .orWhere("users.username", "ilike", `%${query}%`);
      })
      .limit(10);

    res.json(users);
  } catch (err) {
    console.error("Search users error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: Search for events (autocomplete)
router.get("/admin/search-events", requireAdmin, async (req, res) => {
  try {
    const query = req.query.q || '';

    if (query.length < 1) {
      return res.json([]);
    }

    // Search by ID or name (case insensitive) - only future events
    const now = new Date();
    const events = await db("eventoccurrences as eo")
      .join("eventtemplates as et", "eo.eventtemplateid", "et.eventtemplateid")
      .select(
        "eo.eventoccurrenceid",
        "et.eventname",
        "eo.eventdatetimestart",
        "eo.eventlocation"
      )
      .where(function() {
        this.where(db.raw("CAST(eo.eventoccurrenceid AS TEXT)"), "ilike", `%${query}%`)
            .orWhere("et.eventname", "ilike", `%${query}%`);
      })
      .andWhere("eo.eventdatetimestart", ">", now)
      .orderBy("eo.eventdatetimestart", "asc")
      .limit(10);

    res.json(events);
  } catch (err) {
    console.error("Search events error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: Register a user for an event
router.post("/admin/register", requireAdmin, async (req, res) => {
  try {
    const { userid, eventoccurrenceid } = req.body;

    if (!userid || !eventoccurrenceid) {
      return res.status(400).json({ error: "User ID and Event ID are required" });
    }

    // Check if event exists
    const event = await db("eventoccurrences")
      .select("*")
      .where("eventoccurrenceid", eventoccurrenceid)
      .first();

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Check if user exists and get user info
    const user = await db("users")
      .select("users.*")
      .where("users.userid", userid)
      .first();

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if user is already registered
    const existingRegistration = await db("registrations")
      .where({ userid, eventoccurrenceid })
      .first();

    if (existingRegistration) {
      return res.status(400).json({ error: "User is already registered for this event" });
    }

    // Create registration
    await db("registrations").insert({
      userid,
      eventoccurrenceid,
      registrationstatus: "Confirmed",
      registrationcreatedat: new Date(),
      registrationattendedflag: 0,
    });

    res.json({
      success: true,
      message: `Successfully registered ${user.userfirstname} ${user.userlastname} (ID: ${userid}) for event (ID: ${eventoccurrenceid})`
    });
  } catch (err) {
    console.error("Admin register user error:", err);
    res.status(500).json({ error: "Server error: " + err.message });
  }
});

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

    let successMessage = null;
    if (req.query.success === "unregistered") {
      successMessage = "You have been unregistered from the event.";
    }

    res.render("registrations/index", {
      registrations,
      user: req.session.user,
      success: successMessage,
      error: req.query.error || null,
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
