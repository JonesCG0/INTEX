const express = require("express");
const router = express.Router();
const db = require("../db");
const {
  hasText,
  sanitizeText,
  sanitizeEmail,
  sanitizeDecimal,
} = require("../utils/validators");
// Donation helpers
const {
  findOrCreateSupportUser,
  findUserById,
  getAnonymousDonorUser,
  recordDonation,
} = require("../utils/donationService");
// email utility
const { sendEmail } = require("../utils/mailer");

// support donation metadata table
// stores data for the public donations
const SUPPORT_METADATA_TABLE = "support_donations";
let metadataTableReady = false;

async function ensureSupportDonationMetadataTable() {
  if (metadataTableReady) {
    return true;
  }
  try {
    const exists = await db.schema.hasTable(SUPPORT_METADATA_TABLE);
    if (!exists) {
      await db.schema.createTable(SUPPORT_METADATA_TABLE, (table) => {
        table.increments("id").primary();
        table
          .integer("donationid")
          .references("donations.donationid")
          .onDelete("CASCADE");
        table.string("firstname", 120).notNullable();
        table.string("lastname", 120).notNullable();
        table.string("email", 255).nullable();
        table.decimal("donationamount", 12, 2).notNullable();
        table.text("message");
        table.timestamp("createdat").defaultTo(db.fn.now());
      });
    } else {
      await db.schema
        .alterTable(SUPPORT_METADATA_TABLE, (table) => {
          table.string("email", 255).nullable().alter();
        })
        .catch((err) => {
          console.warn(
            "Unable to alter support donation metadata email column (continuing):",
            err
          );
        });
    }
    metadataTableReady = true;
    return true;
  } catch (err) {
    console.error("Unable to ensure support donation metadata table:", err);
    return false;
  }
}

// helps with count and sum queries
async function safeCount(builderFn) {
  try {
    const [row] = await builderFn();
    return Number(row?.count || 0) || 0;
  } catch (err) {
    console.error("Count query error:", err);
    return 0;
  }
}

async function safeDonationTotal() {
  try {
    const row = await db("donations").sum({ total: "donationamount" }).first();
    return Number(row?.total || 0) || 0;
  } catch (err) {
    console.error("Donation total query error:", err);
    return 0;
  }
}

// Home / Landing page
router.get("/", async (req, res) => {
  try {
    // Fetch counts from database
    const [participantCount] = await db("users").count("* as count");
    const [eventCount] = await db("eventoccurrences").count("* as count");
    const [milestoneCount] = await db("milestones").count("* as count");
    const donationSum = await db("donations")
      .sum({ total: "donationamount" })
      .first();
    const totalDonations =
      donationSum && donationSum.total ? Number(donationSum.total) : 0;

    res.render("landing", {
      user: req.session.user || null,
      stats: {
        participants: participantCount.count,
        events: eventCount.count,
        milestones: milestoneCount.count,
        donations: totalDonations,
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

// displays the donation form
router.get("/support", (req, res) => {
  res.render("support", {
    user: req.session.user || null,
    error: null,
    success: null,
    formValues: {
      firstName: "",
      lastName: "",
      email: "",
      amount: "",
      message: "",
    },
  });
});

// Supports the donation submission
//
router.post("/support/donate", async (req, res) => {
  const { firstName, lastName, email, amount, message } = req.body;
  const sessionUser = req.session.user || null;

  const errors = [];
  // cleans the user entered values
  const cleanFirstName = sanitizeText(firstName);
  const cleanLastName = sanitizeText(lastName);
  // validate email if provided
  let cleanEmail = null;
  if (hasText(email)) {
    cleanEmail = sanitizeEmail(email);
    if (!cleanEmail) {
      errors.push("Please enter a valid email address or leave it blank.");
    }
  }
  const cleanAmount = sanitizeDecimal(amount, { min: 1 });
  const cleanMessage = hasText(message) ? message.trim() : null;

  if (!cleanFirstName) {
    errors.push("First name is required");
  }
  if (!cleanLastName) {
    errors.push("Last name is required");
  }
  if (!cleanAmount) {
    errors.push("Please enter a donation amount of at least $1.00");
  }
  // re-render form
  const renderSupport = (status = {}, overrideValues = null) =>
    res.status(status.code || (errors.length ? 400 : 200)).render("support", {
      user: req.session.user || null,
      error: status.error || errors[0] || null,
      success: status.success || null,
      formValues: overrideValues || {
        firstName: cleanFirstName || firstName || "",
        lastName: cleanLastName || lastName || "",
        email: cleanEmail || email || "",
        amount: cleanAmount || amount || "",
        message: cleanMessage || message || "",
      },
    });

  if (errors.length) {
    return renderSupport();
  }

  const metadataReady = await ensureSupportDonationMetadataTable();

  try {
    let donationRecord = null;
    // Run everything in a database
    await db.transaction(async (trx) => {
      let donorUser;

      if (sessionUser && sessionUser.userid) {
        donorUser = await findUserById(sessionUser.userid, trx);
        if (!donorUser) {
          throw new Error(`Authenticated user ${sessionUser.userid} not found`);
        }
      } else if (cleanEmail) {
        donorUser = await findOrCreateSupportUser(
          {
            firstName: cleanFirstName,
            lastName: cleanLastName,
            email: cleanEmail,
          },
          trx
        );
      } else {
        donorUser = await getAnonymousDonorUser(trx);
      }

      donationRecord = await recordDonation(
        {
          userid: donorUser.userid,
          amount: cleanAmount,
          donationDate: new Date().toISOString().slice(0, 10),
        },
        trx
      );

      if (metadataReady) {
        await trx(SUPPORT_METADATA_TABLE)
          .insert({
            donationid: donationRecord.donationid,
            firstname: cleanFirstName,
            lastname: cleanLastName,
            email: cleanEmail,
            donationamount: cleanAmount,
            message: cleanMessage,
          })
          .catch((metaErr) => {
            console.error("Unable to save support donation metadata:", metaErr);
          });
      }
    });

    // sends thank you email if the user entered an email
    if (cleanEmail) {
      const donorFirstName = cleanFirstName || firstName || null;
      const donorLastName = cleanLastName || lastName || null;
      const displayName = [donorFirstName, donorLastName]
        .filter(Boolean)
        .join(" ")
        .trim();
      const greetingName = donorFirstName || displayName || "there";
      const formattedAmount = Number(cleanAmount).toFixed(2);
      const escapeHtml = (value) =>
        value
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
      const textBody = [
        `Hi ${greetingName},`,
        "",
        "Thank you for supporting our participants.",
        `We have recorded your donation of $${formattedAmount}.`,
        "",
        cleanMessage ? `Your note: "${cleanMessage}"` : null,
        "If you have any questions, reply to this email.",
        "",
        "— The INTEX Team",
      ]
        .filter(Boolean)
        .join("\n");
      const htmlBody = `
        <p>Hi ${greetingName},</p>
        <p>Thank you for supporting our participants.</p>
        <p>We have recorded your donation of <strong>$${formattedAmount}</strong>.</p>
        ${
          cleanMessage
            ? `<p><em>Your note:</em> ${escapeHtml(cleanMessage)}</p>`
            : ""
        }
        <p>If you have any questions, reply to this email.</p>
        <p>— The INTEX Team</p>
      `;
      sendEmail({
        to: cleanEmail,
        subject: "Thank you for supporting INTEX",
        text: textBody,
        html: htmlBody,
      }).catch((emailErr) => {
        console.error("Unable to send support donation receipt:", emailErr);
      });
    }

    return renderSupport(
      {
        success: "Thank you! Your donation has been recorded.",
        code: 200,
        error: null,
      },
      {
        firstName: "",
        lastName: "",
        email: "",
        amount: "",
        message: "",
      }
    );
  } catch (err) {
    console.error("Support donation error:", err);
    return renderSupport({
      error: "We could not process your donation. Please try again.",
      code: 500,
    });
  }
});

// Easter egg: 418 I'm a teapot
router.get("/teapot", (req, res) => {
  res.status(418).render("teapot");
});

router.get("/dom", (req, res) => {
  res.render("dom");
});

router.get("/chopped", (req, res) => {
  res.render("chopped");
});

router.get("/redundancy", (req, res) => {
  res.render("redundancy");
});

router.get("/tableau", (req, res) => {
  res.render("tableau");
});

router.get("/rick", (req, res) => {
  res.redirect("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
});

module.exports = router;
