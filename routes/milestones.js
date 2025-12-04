const express = require("express");
const router = express.Router();
const db = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

// List all milestones - any logged in user. 
router.get("/", requireAuth, async (req, res) => {
  try {
    const sortBy = req.query.sortBy || "milestoneid";
    const sortOrder = req.query.sortOrder || "asc";

    const milestones = await db("milestones")
      .select("*")
      .join("users", "milestones.userid", "users.userid")
      .orderBy(sortBy, sortOrder);
    res.render("milestones/index", {
      milestones,
      user: req.session.user,
      sortBy,
      sortOrder,
    });
  } catch (err) {
    console.error("Fetch milestones error:", err);
    res.status(500).send("Server error");
  }
});

// New milestone form
router.get("/new", requireAdmin, async (req, res) => {
  try {
    // Fetch all users for the participant selector
    const users = await db("users")
      .select("userid", "userfirstname", "userlastname", "useremail")
      .orderBy("userfirstname", "asc")
      .orderBy("userlastname", "asc");

    res.render("milestones/new", {
      error: null,
      user: req.session.user,
      users: users
    });
  } catch (err) {
    console.error("Fetch users error:", err);
    res.render("milestones/new", {
      error: "Unable to load users.",
      user: req.session.user,
      users: []
    });
  }
});

// Create milestone
router.post("/new", requireAdmin, async (req, res) => {
  let { milestonetitle, milestonedate, userid } = req.body;

  // Helper function to fetch users
  const getUsers = async () => {
    try {
      return await db("users")
        .select("userid", "userfirstname", "userlastname", "useremail")
        .orderBy("userfirstname", "asc")
        .orderBy("userlastname", "asc");
    } catch (err) {
      console.error("Fetch users error:", err);
      return [];
    }
  };

  // Extract user ID if it's in the format "ID: 123 - FirstName LastName"
  if (userid && typeof userid === 'string') {
    const match = userid.match(/^ID:\s*(\d+)\s*-/);
    if (match) {
      userid = match[1];
    }
  }

  if (!milestonetitle || !milestonedate || !userid) {
    const users = await getUsers();
    return res.status(400).render("milestones/new", {
      error: "All fields are required.",
      user: req.session.user,
      users: users
    });
  }

  try {
    await db("milestones").insert({
      milestonetitle,
      milestonedate,
      userid: parseInt(userid, 10)
    });

    res.redirect("/milestones");
  } catch (err) {
    console.error("Create milestone error:", err);
    const users = await getUsers();
    res.status(500).render("milestones/new", {
      error: "There was a problem creating the milestone.",
      user: req.session.user,
      users: users
    });
  }
});

module.exports = router;
