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
const { formatAsDateInput } = require("../utils/dateHelpers");

// column mapping (users table -> particpant style aliases)
// \select the user fields 
const PARTICIPANT_FIELD_MAP = {
  participantid: "userid",
  participantfirstname: "userfirstname",
  participantlastname: "userlastname",
  participantemail: "useremail",
  participantphone: "userphone",
  participantzip: "userzip",
  participantdob: "userdob",
  participantrole: "userrole",
  participantschooloremployer: "userschooloremployer",
  participantfieldofinterest: "userfieldofinterest",
};

// Builds a select list in the format: Column as alias. 
const participantSelectColumns = Object.entries(PARTICIPANT_FIELD_MAP).map(
  ([alias, column]) => `${column} as ${alias}`
);

// save and valid fields. 
function resolveSort(sortByRaw, sortOrderRaw) {
  const defaultSortBy = "participantid";
  const safeSortBy = PARTICIPANT_FIELD_MAP[sortByRaw] ? sortByRaw : defaultSortBy;
  const sortColumn = PARTICIPANT_FIELD_MAP[safeSortBy];
  const sortOrder = sortOrderRaw === "desc" ? "desc" : "asc";
  return { sortBy: safeSortBy, sortOrder, sortColumn };
}

// sanitizes the form inputs into database ready fields. 
function buildParticipantPayload(body) {
  const payload = {
    userfirstname: sanitizeText(body.participantfirstname),
    userlastname: sanitizeText(body.participantlastname),
    useremail: null,
    userphone: sanitizePhone(body.participantphone),
    userzip: sanitizeZip(body.participantzip),
    userdob: sanitizeISODate(body.participantdob),
    userrole: sanitizeText(body.participantrole),
    userschooloremployer: sanitizeText(body.participantschooloremployer),
    userfieldofinterest: sanitizeText(body.participantfieldofinterest),
  };

  const errors = [];

  if (!payload.userfirstname || !payload.userlastname) {
    errors.push("Participant first and last name are required");
  }

  if (hasText(body.participantemail)) {
    payload.useremail = sanitizeEmail(body.participantemail);
    if (!payload.useremail) {
      errors.push("Participant email must be valid");
    }
  }

  if (!payload.userphone) {
    errors.push("Participant phone number must include at least 10 digits");
  }

  if (!payload.userzip) {
    errors.push("Participant ZIP code must be 5 or 9 digits");
  }

  if (!payload.userdob) {
    errors.push("Participant date of birth must be a valid YYYY-MM-DD value");
  }

  payload.userrole =
    payload.userrole && payload.userrole.toLowerCase() === "admin"
      ? "admin"
      : "participant";

  return { payload, errors };
}

// List all participants requires authorization
router.get("/", requireAuth, async (req, res) => {
  try {
    const { sortBy, sortOrder, sortColumn } = resolveSort(
      req.query.sortBy,
      req.query.sortOrder
    );

    const participants = await db("users")
      .select(participantSelectColumns)
      .orderBy(sortColumn, sortOrder);
    res.render("participants/index", {
      participants,
      user: req.session.user,
      sortBy,
      sortOrder,
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
    const [created] = await db("users").insert(payload).returning(["userid"]);

    res.redirect(`/participants/${created.userid}`);
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
    const participant = await db("users")
      .select(participantSelectColumns)
      .where({ userid: req.params.id })
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
    const participant = await db("users")
      .select(participantSelectColumns)
      .where({ userid: req.params.id })
      .first();

    if (!participant) {
      return res.status(404).send("Participant not found");
    }

    const participantForView = {
      ...participant,
      participantdobInputValue: formatAsDateInput(participant.participantdob),
    };

    res.render("participants/edit", {
      participant: participantForView,
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

  // make sure the participant exists before updating. 
  try {
    existing = await db("users")
      .select(participantSelectColumns)
      .where({ userid: participantId })
      .first();
  } catch (err) {
    console.error("Fetch participant for update error:", err);
    return res.status(500).send("Server error");
  }

  if (!existing) {
    return res.status(404).send("Participant not found");
  }

  const { payload, errors } = buildParticipantPayload(req.body);

  // helper to create a view model with the correct DOB formatting. 
  const buildParticipantViewModel = (source) => ({
    ...source,
    participantdobInputValue:
      typeof source.participantdobInputValue !== "undefined"
        ? source.participantdobInputValue
        : formatAsDateInput(source.participantdob),
  });

  if (errors.length) {
    const participantView = buildParticipantViewModel({
      ...existing,
      ...req.body,
      participantdobInputValue:
        req.body.participantdob || formatAsDateInput(existing.participantdob),
    });

    return res.status(400).render("participants/edit", {
      participant: participantView,
      error: errors[0],
      user: req.session.user,
    });
  }
// actually update 
  try {
    await db("users").where({ userid: participantId }).update(payload);
    res.redirect(`/participants/${participantId}`);
  } catch (err) {
    console.error("Update participant error:", err);
    const participantView = buildParticipantViewModel({
      ...existing,
      ...req.body,
      participantdobInputValue:
        req.body.participantdob || formatAsDateInput(existing.participantdob),
    });

    res.status(500).render("participants/edit", {
      participant: participantView,
      error: "Unable to update participant",
      user: req.session.user,
    });
  }
});

module.exports = router;
