const express = require("express");
const router = express.Router();
const db = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

// ---------------------------------------------------------------------------
// List all events
// ---------------------------------------------------------------------------
router.get("/", requireAuth, async (req, res) => {
  try {
    const sortBy = req.query.sortBy || "eventoccurrenceid";
    const sortOrder = req.query.sortOrder || "asc";

    const events = await db
      .select("*")
      .from("eventoccurrences")
      .join(
        "eventtemplates",
        "eventoccurrences.eventtemplateid",
        "eventtemplates.eventtemplateid"
      )
      .orderBy(sortBy, sortOrder);
    res.render("events/index", {
      events,
      user: req.session.user || null,
      sortBy,
      sortOrder,
    });
  } catch (err) {
    console.error("Fetch events error:", err);
    res.status(500).send("Server error");
  }
});

// ---------------------------------------------------------------------------
// New event form (ADMIN)
// ---------------------------------------------------------------------------
router.get("/new", requireAdmin, async (req, res) => {
  try {
    // Fetch all event templates to populate the dropdowns
    const eventTemplates = await db
      .select("eventtemplateid", "eventname")
      .from("eventtemplates")
      .whereNotNull("eventname")
      .orderBy("eventname", "asc");

    res.render("events/new", {
      error: null,
      user: req.session.user,
      eventTemplates: eventTemplates,
    });
  } catch (err) {
    console.error("Fetch event templates error:", err);
    res.render("events/new", {
      error: "Unable to load event templates.",
      user: req.session.user,
      eventTemplates: [],
    });
  }
});

// ---------------------------------------------------------------------------
// Create event (ADMIN)
// Creates a new template + a single occurrence based on title + date
// ---------------------------------------------------------------------------
router.post("/new", requireAdmin, async (req, res) => {
  // Helper function to fetch event templates
  const getEventTemplates = async () => {
    try {
      return await db
        .select("eventtemplateid", "eventname")
        .from("eventtemplates")
        .whereNotNull("eventname")
        .orderBy("eventname", "asc");
    } catch (err) {
      console.error("Fetch event templates error:", err);
      return [];
    }
  };

  if (!req.body.eventTemplateID || !req.body.eventdatetimestart) {
    const eventTemplates = await getEventTemplates();
    return res.status(400).render("events/new", {
      error: "Title and date are required.",
      user: req.session.user,
      eventTemplates: eventTemplates,
    });
  }

  try {
    const eventId = await db.transaction(async (trx) => {
      // Create the event occurrence
      const [occurrence] = await trx("eventoccurrences")
        .insert({
          eventdatetimestart: req.body.eventdatetimestart,
          eventdatetimeend: req.body.eventdatetimeend,
          eventlocation: req.body.eventlocation,
          eventcapacity: req.body.eventcapacity,
          eventregistrationdeadline: req.body.eventregistrationdeadline,
          eventtemplateid: req.body.eventTemplateID,
        })
        .returning("eventoccurrenceid");

      return occurrence.eventoccurrenceid;
    });

    // Redirect to the show page for the new event
    res.redirect(`/events/${eventId}`);
  } catch (err) {
    console.error("Create event error:", err);
    const eventTemplates = await getEventTemplates();
    res.status(500).render("events/new", {
      error: "There was a problem creating the event.",
      user: req.session.user,
      eventTemplates: eventTemplates,
    });
  }
});

// ---------------------------------------------------------------------------
// Show single event (ADMIN)
// ---------------------------------------------------------------------------
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const event = await db("eventoccurrences")
      .join(
        "eventtemplates",
        "eventoccurrences.eventtemplateid",
        "eventtemplates.eventtemplateid"
      )
      .select("*")
      .where({ eventoccurrenceid: req.params.id })
      .first();

    if (!event) {
      return res.status(404).send("Event not found");
    }

    res.render("events/show", {
      event,
      user: req.session.user,
    });
  } catch (err) {
    console.error("Fetch event error:", err);
    res.status(500).send("Server error");
  }
});

// ---------------------------------------------------------------------------
// Edit event form (ADMIN)
// ---------------------------------------------------------------------------
router.get("/:id/edit", requireAdmin, async (req, res) => {
  try {
    const event = await db("eventoccurrences as eo")
      .join("eventtemplates as et", "eo.eventtemplateid", "et.eventtemplateid")
      .select(
        "eo.eventoccurrenceid as eventid",
        "et.eventname as title",
        "eo.eventdatetimestart as date",
        "eo.eventdatetimeend",
        "eo.eventlocation",
        "eo.eventcapacity",
        "eo.eventregistrationdeadline",
        "et.eventtemplateid",
        "et.eventtype",
        "et.eventdescription",
        "et.eventrecurrencepattern",
        "et.eventdefaultcapacity"
      )
      .where("eo.eventoccurrenceid", req.params.id)
      .first();

    if (!event) {
      return res.status(404).send("Event not found");
    }

    res.render("events/edit", {
      event,
      error: null,
      user: req.session.user,
    });
  } catch (err) {
    console.error("Fetch event error:", err);
    res.status(500).send("Server error");
  }
});

// ---------------------------------------------------------------------------
// Update event (ADMIN)
// Updates template name + occurrence start date
// ---------------------------------------------------------------------------
router.post("/:id/edit", requireAdmin, async (req, res) => {
  const { title, date } = req.body;
  const eventId = req.params.id;

  try {
    if (!title || !date) {
      // Re-fetch event and re-render with error
      const existing = await db("eventoccurrences as eo")
        .join(
          "eventtemplates as et",
          "eo.eventtemplateid",
          "et.eventtemplateid"
        )
        .select(
          "eo.eventoccurrenceid as eventid",
          "et.eventname as title",
          "eo.eventdatetimestart as date",
          "eo.eventdatetimeend",
          "eo.eventlocation",
          "eo.eventcapacity",
          "eo.eventregistrationdeadline",
          "et.eventtemplateid",
          "et.eventtype",
          "et.eventdescription",
          "et.eventrecurrencepattern",
          "et.eventdefaultcapacity"
        )
        .where("eo.eventoccurrenceid", eventId)
        .first();

      if (!existing) {
        return res.status(404).send("Event not found");
      }

      return res.status(400).render("events/edit", {
        event: existing,
        error: "Title and date are required.",
        user: req.session.user,
      });
    }

    await db.transaction(async (trx) => {
      // Get template id for this occurrence
      const occurrence = await trx("eventoccurrences")
        .select("eventtemplateid")
        .where({ eventoccurrenceid: eventId })
        .first();

      if (!occurrence) {
        throw new Error("Event not found");
      }

      const templateId = occurrence.eventtemplateid;

      // 1) Update template name
      await trx("eventtemplates")
        .where({ eventtemplateid: templateId })
        .update({ eventname: title });

      // 2) Update occurrence date
      await trx("eventoccurrences")
        .where({ eventoccurrenceid: eventId })
        .update({ eventdatetimestart: date });
    });

    res.redirect(`/events/${eventId}`);
  } catch (err) {
    console.error("Update event error:", err);
    res.status(500).send("Server error");
  }
});

module.exports = router;
