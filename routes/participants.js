const express = require("express");
const router = express.Router();
const db = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const {
  hasText,
  sanitizeText,
  sanitizeEmail,
  sanitizePhone,
  sanitizeZip,
  sanitizeISODate,
} = require("../utils/validators");

function buildParticipantPayload(body) {
  const payload = {
    participantfirstname: sanitizeText(body.participantfirstname),
    participantlastname: sanitizeText(body.participantlastname),
    participantemail: null,
    participantphone: sanitizePhone(body.participantphone),
    participantzip: sanitizeZip(body.participantzip),
    participantdob: sanitizeISODate(body.participantdob),
    participantrole: sanitizeText(body.participantrole),
    participantschooloremployer: sanitizeText(body.participantschooloremployer),
    participantfieldofinterest: sanitizeText(body.participantfieldofinterest),
  };

  const errors = [];

  if (!payload.participantfirstname || !payload.participantlastname) {
    errors.push("Participant first and last name are required");
  }

  if (hasText(body.participantemail)) {
    payload.participantemail = sanitizeEmail(body.participantemail);
    if (!payload.participantemail) {
      errors.push("Participant email must be valid");
    }
  }

  if (!payload.participantphone) {
    errors.push("Participant phone number must include at least 10 digits");
  }

  if (!payload.participantzip) {
    errors.push("Participant ZIP code must be 5 or 9 digits");
  }

  if (!payload.participantdob) {
    errors.push("Participant date of birth must be a valid YYYY-MM-DD value");
  }

  return { payload, errors };
}

// List all participants
router.get("/", requireAuth, async (req, res) => {
  try {
    const participants = await db("participants")
      .select("*")
      .orderBy("participantid");
    res.render("participants/index", {
      participants,
      user: req.session.user,
    });
  } catch (err) {
    console.error("Fetch participants error:", err);
    res.status(500).send("Server error");
  }
});

// New participant form
router.get("/new", requireAdmin, (req, res) => {
  res.render("participants/new", { error: null, user: req.session.user });
});

// Create participant
router.post("/new", requireAdmin, async (req, res) => {
  const { payload, errors } = buildParticipantPayload(req.body);

  if (errors.length) {
    return res
      .status(400)
      .render("participants/new", { error: errors[0], user: req.session.user });
  }

  try {
    const [created] = await db("participants")
      .insert(payload)
      .returning("participantid");

    res.redirect(`/participants/${created.participantid}`);
  } catch (err) {
    console.error("Create participant error:", err);
    res.status(500).render("participants/new", {
      error: "Unable to create participant",
      user: req.session.user,
    });
  }
});

// Show single participant
router.get("/:id", requireAdmin, async (req, res) => {
  try {
    const participant = await db("participants")
      .select("*")
      .where({ participantid: req.params.id })
      .first();

    if (!participant) {
      return res.status(404).send("Participant not found");
    }

    res.render("participants/show", {
      participant,
      user: req.session.user,
    });
  } catch (err) {
    console.error("Fetch participant error:", err);
    res.status(500).send("Server error");
  }
});

// Edit participant form
router.get("/:id/edit", requireAdmin, async (req, res) => {
  try {
    const participant = await db("participants")
      .select("*")
      .where({ participantid: req.params.id })
      .first();

    if (!participant) {
      return res.status(404).send("Participant not found");
    }

    res.render("participants/edit", {
      participant,
      error: null,
      user: req.session.user,
    });
  } catch (err) {
    console.error("Fetch participant error:", err);
    res.status(500).send("Server error");
  }
});

// Update participant
router.post("/:id/edit", requireAdmin, async (req, res) => {
  const participantId = req.params.id;
  let existing;

  try {
    existing = await db("participants")
      .select("*")
      .where({ participantid: participantId })
      .first();
  } catch (err) {
    console.error("Fetch participant for update error:", err);
    return res.status(500).send("Server error");
  }

  if (!existing) {
    return res.status(404).send("Participant not found");
  }

  const { payload, errors } = buildParticipantPayload(req.body);

  if (errors.length) {
    return res.status(400).render("participants/edit", {
      participant: { ...existing, ...req.body },
      error: errors[0],
      user: req.session.user,
    });
  }

  try {
    await db("participants").where({ participantid: participantId }).update(payload);
    res.redirect(`/participants/${participantId}`);
  } catch (err) {
    console.error("Update participant error:", err);
    res.status(500).render("participants/edit", {
      participant: { ...existing, ...req.body },
      error: "Unable to update participant",
      user: req.session.user,
    });
  }
});

module.exports = router;
