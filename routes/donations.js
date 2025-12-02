const express = require("express");
const router = express.Router();
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const {
  hasText,
  sanitizeISODate,
  sanitizeDecimal,
  sanitizeInt,
} = require("../utils/validators");

// List all donations
router.get("/", requireAuth, async (req, res) => {
  try {
    const donations = await db("donations").select("*").orderBy("donationid");
    res.render("donations/index", {
      donations,
      user: req.session.user,
    });
  } catch (err) {
    console.error("Fetch donations error:", err);
    res.status(500).send("Server error");
  }
});

// New donation form
router.get("/new", requireAuth, (req, res) => {
  res.render("donations/new", { error: null, user: req.session.user });
});

// Create donation
router.post("/new", requireAuth, async (req, res) => {
  const { donationdate, donationamount, participantid } = req.body;

  const errors = [];
  const cleanAmount = sanitizeDecimal(donationamount, { min: 0.01 });
  const cleanParticipantId = sanitizeInt(participantid, { min: 1 });
  let cleanDate = null;

  if (hasText(donationdate)) {
    cleanDate = sanitizeISODate(donationdate);
    if (!cleanDate) {
      errors.push("Donation date must be a valid YYYY-MM-DD value");
    }
  }
  if (!cleanAmount) {
    errors.push("Donation amount must be at least $0.01");
  }
  if (!cleanParticipantId) {
    errors.push("Participant ID must be a positive whole number");
  }

  if (errors.length) {
    return res
      .status(400)
      .render("donations/new", { error: errors[0], user: req.session.user });
  }

  try {
    const participantExists = await db("participants")
      .select("participantid")
      .where({ participantid: cleanParticipantId })
      .first();

    if (!participantExists) {
      return res.status(400).render("donations/new", {
        error: "Participant not found",
        user: req.session.user,
      });
    }

    const donationPayload = {
      participantid: cleanParticipantId,
      donationamount: cleanAmount,
    };

    if (cleanDate) {
      donationPayload.donationdate = cleanDate;
    }

    await db("donations").insert(donationPayload);
    res.redirect("/donations");
  } catch (err) {
    console.error("Create donation error:", err);
    res
      .status(500)
      .render("donations/new", { error: "Server error", user: req.session.user });
  }
});

module.exports = router;
