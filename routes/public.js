const express = require("express");
const router = express.Router();
const db = require("../db");

// Home / Landing page
router.get("/", async (req, res) => {
  try {
    // Fetch counts from database
    const [participantCount] = await db("participants").count("* as count");
    const [eventCount] = await db("eventoccurrences").count("* as count");
    const [milestoneCount] = await db("milestones").count("* as count");
    const donationSum = await db("donationtotals")
      .select(db.raw("SUM(CAST(totalDonationCalculated AS DECIMAL)) as total"))
      .first();

    res.render("landing", {
      user: req.session.user || null,
      stats: {
        participants: participantCount.count,
        events: eventCount.count,
        milestones: milestoneCount.count,
        donations: donationSum.total || 0,
      },
    });
  } catch (err) {
    console.error("Landing page error:", err);
    // Render with default values if there's an error
    res.render("landing", {
      user: req.session.user || null,
      stats: {
        participants: 0,
        events: 0,
        milestones: 0,
        donations: 0,
      },
    });
  }
});

router.get("/support", (req, res) => {
  res.render("support", {
    user: req.session.user || null,
  });
});

// Easter egg: 418 I'm a teapot
router.get("/teapot", (req, res) => {
  res.status(418).render("teapot");
});

module.exports = router;
