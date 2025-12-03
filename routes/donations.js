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
const { findUserById, recordDonation } = require("../utils/donationService");

// List all donations
router.get("/", requireAuth, async (req, res) => {
  try {
    const sortBy = req.query.sortBy || "donationid";
    const sortOrder = req.query.sortOrder || "asc";

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
router.get("/new", requireAuth, (req, res) => {
  res.render("donations/new", { error: null, user: req.session.user });
});

// Create donation
router.post("/new", requireAuth, async (req, res) => {
  const { donationdate, donationamount, userid } = req.body;

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

  if (errors.length) {
    return res
      .status(400)
      .render("donations/new", { error: errors[0], user: req.session.user });
  }

  try {
    await db.transaction(async (trx) => {
      const userRecord = await findUserById(cleanUserId, trx);

      if (!userRecord) {
        throw new Error("USER_NOT_FOUND");
      }

      await recordDonation(
        {
          userid: cleanUserId,
          amount: cleanAmount,
          donationDate: cleanDate || new Date().toISOString().slice(0, 10),
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

module.exports = router;
