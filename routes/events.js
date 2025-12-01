const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAdmin } = require("../middleware/auth");

// Helper: common SELECT used by list/show/edit
const EVENT_SELECT = `
  SELECT
    eo.eventoccurrenceid AS eventid,
    et.eventname AS title,
    eo.eventdatetimestart AS date,
    eo.eventdatetimeend,
    eo.eventlocation,
    eo.eventcapacity,
    eo.eventregistrationdeadline,
    et.eventtemplateid,
    et.eventtype,
    et.eventdescription,
    et.eventrecurrencepattern,
    et.eventdefaultcapacity
  FROM eventoccurrences eo
  JOIN eventtemplates et ON eo.eventtemplateid = et.eventtemplateid
`;

// ---------------------------------------------------------------------------
// List all events
// ---------------------------------------------------------------------------
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      EVENT_SELECT + " ORDER BY eo.eventdatetimestart"
    );

    res.render("events/index", {
      events: result.rows,
      user: req.session.user || null,
    });
  } catch (err) {
    console.error("Fetch events error:", err);
    res.status(500).send("Server error");
  }
});

// ---------------------------------------------------------------------------
// New event form (ADMIN)
// ---------------------------------------------------------------------------
router.get("/new", requireAdmin, (req, res) => {
  res.render("events/new", {
    error: null,
    user: req.session.user,
  });
});

// ---------------------------------------------------------------------------
// Create event (ADMIN)
// Creates a new template + a single occurrence based on title + date
// ---------------------------------------------------------------------------
router.post("/new", requireAdmin, async (req, res) => {
  const { title, date } = req.body;

  if (!title || !date) {
    return res.status(400).render("events/new", {
      error: "Title and date are required.",
      user: req.session.user,
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1) Create an event template (minimal fields)
    const templateResult = await client.query(
      `
        INSERT INTO eventtemplates (eventname, eventtype, eventdescription, eventrecurrencepattern, eventdefaultcapacity)
        VALUES ($1, NULL, NULL, NULL, NULL)
        RETURNING eventtemplateid
      `,
      [title]
    );

    const templateId = templateResult.rows[0].eventtemplateid;

    // 2) Create the event occurrence
    // We store the submitted date directly into eventdatetimestart (text column)
    const occurrenceResult = await client.query(
      `
        INSERT INTO eventoccurrences (
          eventdatetimestart,
          eventdatetimeend,
          eventlocation,
          eventcapacity,
          eventregistrationdeadline,
          eventtemplateid
        )
        VALUES ($1, NULL, NULL, NULL, NULL, $2)
        RETURNING eventoccurrenceid
      `,
      [date, templateId]
    );

    const eventId = occurrenceResult.rows[0].eventoccurrenceid;

    await client.query("COMMIT");

    // Redirect to the show page for the new event
    res.redirect(`/events/${eventId}`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Create event error:", err);
    res.status(500).render("events/new", {
      error: "There was a problem creating the event.",
      user: req.session.user,
    });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------------------
// Show single event (ADMIN)
// ---------------------------------------------------------------------------
router.get("/:id", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      EVENT_SELECT + " WHERE eo.eventoccurrenceid = $1",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("Event not found");
    }

    res.render("events/show", {
      event: result.rows[0],
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
    const result = await pool.query(
      EVENT_SELECT + " WHERE eo.eventoccurrenceid = $1",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("Event not found");
    }

    res.render("events/edit", {
      event: result.rows[0],
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

  const client = await pool.connect();

  try {
    if (!title || !date) {
      // Re-fetch event and re-render with error
      const existing = await pool.query(
        EVENT_SELECT + " WHERE eo.eventoccurrenceid = $1",
        [eventId]
      );

      if (existing.rows.length === 0) {
        client.release();
        return res.status(404).send("Event not found");
      }

      return res.status(400).render("events/edit", {
        event: existing.rows[0],
        error: "Title and date are required.",
        user: req.session.user,
      });
    }

    await client.query("BEGIN");

    // Get template id for this occurrence
    const templateIdResult = await client.query(
      `
        SELECT eventtemplateid
        FROM eventoccurrences
        WHERE eventoccurrenceid = $1
      `,
      [eventId]
    );

    if (templateIdResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).send("Event not found");
    }

    const templateId = templateIdResult.rows[0].eventtemplateid;

    // 1) Update template name
    await client.query(
      `
        UPDATE eventtemplates
        SET eventname = $1
        WHERE eventtemplateid = $2
      `,
      [title, templateId]
    );

    // 2) Update occurrence date
    await client.query(
      `
        UPDATE eventoccurrences
        SET eventdatetimestart = $1
        WHERE eventoccurrenceid = $2
      `,
      [date, eventId]
    );

    await client.query("COMMIT");

    res.redirect(`/events/${eventId}`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Update event error:", err);
    res.status(500).send("Server error");
  } finally {
    client.release();
  }
});

module.exports = router;
