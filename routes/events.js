const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

// List all events
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM events ORDER BY eventid");
    res.render("events/index", {
      events: result.rows,
      user: req.session.user || null,
    });
  } catch (err) {
    console.error("Fetch events error:", err);
    res.status(500).send("Server error");
  }
});

// New event form
router.get("/new", requireAdmin, (req, res) => {
  res.render("events/new", { error: null, user: req.session.user });
});

// Create event
router.post("/new", requireAdmin, async (req, res) => {
  // Add your create logic here
  res.redirect("/events");
});

// Show single event
router.get("/:id", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM events WHERE eventid = $1", [
      req.params.id,
    ]);

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

// Edit event form
router.get("/:id/edit", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM events WHERE eventid = $1", [
      req.params.id,
    ]);

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

// Update event
router.post("/:id/edit", requireAdmin, async (req, res) => {
  // Add your update logic here
  res.redirect(`/events/${req.params.id}`);
});

module.exports = router;
