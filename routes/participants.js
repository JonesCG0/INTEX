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

const PARTICIPANT_ROLE = "participant";
const PARTICIPANT_SELECT_COLUMNS = [
  "userid as participantid",
  "userfirstname as participantfirstname",
  "userlastname as participantlastname",
  "useremail as participantemail",
  "userphone as participantphone",
  "userzip as participantzip",
  "userdob as participantdob",
  "userrole as participantrole",
  "userschooloremployer as participantschooloremployer",
  "userfieldofinterest as participantfieldofinterest",
];
const PARTICIPANT_SORTABLE_COLUMNS = {
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

function resolveSortOptions(query) {
  const requestedSortBy = query.sortBy;
  const sortBy = PARTICIPANT_SORTABLE_COLUMNS[requestedSortBy]
    ? requestedSortBy
    : "participantid";
  const requestedOrder =
    typeof query.sortOrder === "string" ? query.sortOrder.toLowerCase() : "asc";
  const sortOrder = requestedOrder === "desc" ? "desc" : "asc";

  return {
    sortBy,
    sortOrder,
    sortColumn: PARTICIPANT_SORTABLE_COLUMNS[sortBy],
  };
}

function baseParticipantQuery() {
  return db("users")
    .select(PARTICIPANT_SELECT_COLUMNS)
    .where({ userrole: PARTICIPANT_ROLE });
}

function getParticipantById(participantId) {
  return baseParticipantQuery().where({ userid: participantId }).first();
}

function buildParticipantPayload(body) {
  const participant = {
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

  if (!participant.participantfirstname || !participant.participantlastname) {
    errors.push("Participant first and last name are required");
  }

  if (hasText(body.participantemail)) {
    participant.participantemail = sanitizeEmail(body.participantemail);
    if (!participant.participantemail) {
      errors.push("Participant email must be valid");
    }
  }

  if (!participant.participantphone) {
    errors.push("Participant phone number must include at least 10 digits");
  }

  if (!participant.participantzip) {
    errors.push("Participant ZIP code must be 5 or 9 digits");
  }

  if (!participant.participantdob) {
    errors.push("Participant date of birth must be a valid YYYY-MM-DD value");
  }

  const payload = {
    userfirstname: participant.participantfirstname,
    userlastname: participant.participantlastname,
    useremail: participant.participantemail,
    userphone: participant.participantphone,
    userzip: participant.participantzip,
    userdob: participant.participantdob,
    userrole: PARTICIPANT_ROLE,
    userschooloremployer: participant.participantschooloremployer,
    userfieldofinterest: participant.participantfieldofinterest,
  };

  return { payload, errors };
}

// List all participants
router.get("/", requireAuth, async (req, res) => {
  try {
    const { sortBy, sortOrder, sortColumn } = resolveSortOptions(req.query);
    const participants = await baseParticipantQuery().orderBy(sortColumn, sortOrder);

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
    const [created] = await db("users").insert(payload).returning("userid");

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
    const participant = await getParticipantById(req.params.id);

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
    const participant = await getParticipantById(req.params.id);

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

  try {
    existing = await getParticipantById(participantId);
  } catch (err) {
    console.error("Fetch participant for update error:", err);
    return res.status(500).send("Server error");
  }

  if (!existing) {
    return res.status(404).send("Participant not found");
  }

  const { payload, errors } = buildParticipantPayload(req.body);

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
