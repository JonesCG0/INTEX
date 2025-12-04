// validation
const express = require("express");
const router = express.Router();
const db = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const {
  hasText,
  sanitizeISODate,
  sanitizeDecimal,
  sanitizeInt,
} = require("../utils/validators");
// donation helper functions
const { findUserById, recordDonation } = require("../utils/donationService");

function buildDonationPayload(body) {
  const { donationdate, donationamount, userid } = body;

  const errors = [];
  const cleanAmount = sanitizeDecimal(donationamount, { min: 0.01 });
  const cleanUserId = sanitizeInt(userid, { min: 1 });
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
  if (!cleanUserId) {
    errors.push("User ID must be a positive whole number");
  }

  return {
    errors,
    payload: {
      userid: cleanUserId,
      donationamount: cleanAmount,
      donationdate: cleanDate,
    },
  };
}

// List all donations
router.get("/", requireAuth, async (req, res) => {
  try {
    const sortBy = req.query.sortBy || "donationid";
    const sortOrder = req.query.sortOrder || "asc";
    // join the donations with the users table so names can be shown
    const donations = await db("donations")
      .select("*")
      .join("users", "donations.userid", "users.userid")
      .orderBy(sortBy, sortOrder);
    res.render("donations/index", {
      donations,
      user: req.session.user,
      sortBy,
      sortOrder,
    });
  } catch (err) {
    console.error("Fetch donations error:", err);
    res.status(500).send("Server error");
  }
});

// New donation form
router.get("/new", requireAdmin, (req, res) => {
  res.render("donations/new", { error: null, user: req.session.user });
});

// Create donation
router.post("/new", requireAdmin, async (req, res) => {
  const { errors, payload } = buildDonationPayload(req.body);

  if (errors.length) {
    return res
      .status(400)
      .render("donations/new", { error: errors[0], user: req.session.user });
  }

  // uses a trnsaction for safety find the user and then create the donation
  try {
    await db.transaction(async (trx) => {
      const userRecord = await findUserById(payload.userid, trx);

      if (!userRecord) {
        throw new Error("USER_NOT_FOUND");
      }
// insert the donation using service helper and cleaned
      await recordDonation(
        {
          userid: payload.userid,
          amount: payload.donationamount,
          donationDate:
            payload.donationdate || new Date().toISOString().slice(0, 10),
        },
        trx
      );
    });

    res.redirect("/donations");
  } catch (err) {
    if (err.message === "USER_NOT_FOUND") {
      return res.status(400).render("donations/new", {
        error: "User not found. Please verify the ID from the Users list.",
        user: req.session.user,
      });
    }
    console.error("Create donation error:", err);
    res
      .status(500)
      .render("donations/new", { error: "Server error", user: req.session.user });
  }
});

// Edit donation form - admin only
router.get("/:id/edit", requireAdmin, async (req, res) => {
  try {
    const donation = await db("donations")
      .join("users", "donations.userid", "users.userid")
      .select(
        "donations.donationid",
        "donations.donationdate",
        "donations.donationamount",
        "donations.userid",
        "users.userfirstname",
        "users.userlastname"
      )
      .where("donations.donationid", req.params.id)
      .first();

    if (!donation) {
      return res.status(404).send("Donation not found");
    }

    res.render("donations/edit", {
      donation,
      error: null,
      user: req.session.user,
    });
  } catch (err) {
    console.error("Fetch donation for edit error:", err);
    res.status(500).send("Server error");
  }
});

// Update donation - admin only
router.post("/:id/edit", requireAdmin, async (req, res) => {
  const donationId = req.params.id;

  let existing;
  try {
    existing = await db("donations").where({ donationid: donationId }).first();
  } catch (err) {
    console.error("Fetch donation for update error:", err);
    return res.status(500).send("Server error");
  }

  if (!existing) {
    return res.status(404).send("Donation not found");
  }

  const { errors, payload } = buildDonationPayload(req.body);

  if (errors.length) {
    const donationView = {
      ...existing,
      ...req.body,
    };

    return res.status(400).render("donations/edit", {
      donation: donationView,
      error: errors[0],
      user: req.session.user,
    });
  }

  try {
    await db("donations")
      .where({ donationid: donationId })
      .update({
        donationdate:
          payload.donationdate || existing.donationdate || new Date(),
        donationamount: payload.donationamount,
        userid: payload.userid,
      });

    res.redirect("/donations");
  } catch (err) {
    console.error("Update donation error:", err);
    const donationView = {
      ...existing,
      ...req.body,
    };

    res.status(500).render("donations/edit", {
      donation: donationView,
      error: "Unable to update donation",
      user: req.session.user,
    });
  }
});

// Delete donation - admin only
router.post("/:id/delete", requireAdmin, async (req, res) => {
  const donationId = req.params.id;

  try {
    await db("donations").where({ donationid: donationId }).del();
    res.redirect("/donations");
  } catch (err) {
    console.error("Delete donation error:", err);
    res.status(500).send("Server error");
  }
});

module.exports = router;
