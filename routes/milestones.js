const express = require("express");
const router = express.Router();
const db = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

async function getUsersForSelect() {
  try {
    return await db("users")
      .select("userid", "userfirstname", "userlastname", "useremail")
      .orderBy("userfirstname", "asc")
      .orderBy("userlastname", "asc");
  } catch (err) {
    console.error("Fetch users error:", err);
    return [];
  }
}

// List all milestones
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
  const users = await getUsersForSelect();
  res.render("milestones/new", {
    error: null,
    user: req.session.user,
    users,
  });
});

// Create milestone
router.post("/new", requireAdmin, async (req, res) => {
  let { milestonetitle, milestonedate, userid } = req.body;

  // Extract user ID if it's in the format "ID: 123 - FirstName LastName"
  if (userid && typeof userid === "string") {
    const match = userid.match(/^ID:\s*(\d+)\s*-/);
    if (match) {
      userid = match[1];
    }
  }

  if (!milestonetitle || !milestonedate || !userid) {
    const users = await getUsersForSelect();
    return res.status(400).render("milestones/new", {
      error: "All fields are required.",
      user: req.session.user,
      users,
    });
  }

  try {
    await db("milestones").insert({
      milestonetitle,
      milestonedate,
      userid: parseInt(userid, 10),
    });

    res.redirect("/milestones");
  } catch (err) {
    console.error("Create milestone error:", err);
    const users = await getUsersForSelect();
    res.status(500).render("milestones/new", {
      error: "There was a problem creating the milestone.",
      user: req.session.user,
      users,
    });
  }
});

// Edit milestone form
router.get("/:id/edit", requireAdmin, async (req, res) => {
  const milestoneId = req.params.id;

  try {
    const milestone = await db("milestones")
      .join("users", "milestones.userid", "users.userid")
      .select(
        "milestones.milestoneid",
        "milestones.milestonetitle",
        "milestones.milestonedate",
        "milestones.userid",
        "users.userfirstname",
        "users.userlastname",
        "users.useremail"
      )
      .where("milestones.milestoneid", milestoneId)
      .first();

    if (!milestone) {
      return res.status(404).send("Milestone not found");
    }

    const users = await getUsersForSelect();

    res.render("milestones/edit", {
      milestone,
      users,
      error: null,
      user: req.session.user,
    });
  } catch (err) {
    console.error("Fetch milestone for edit error:", err);
    res.status(500).send("Server error");
  }
});

// Update milestone
router.post("/:id/edit", requireAdmin, async (req, res) => {
  const milestoneId = req.params.id;
  let { milestonetitle, milestonedate, userid } = req.body;

  if (userid && typeof userid === "string") {
    const match = userid.match(/^ID:\s*(\d+)\s*-/);
    if (match) {
      userid = match[1];
    }
  }

  if (!milestonetitle || !milestonedate || !userid) {
    const users = await getUsersForSelect();
    return res.status(400).render("milestones/edit", {
      milestone: {
        milestoneid: milestoneId,
        milestonetitle,
        milestonedate,
        userid,
      },
      users,
      error: "All fields are required.",
      user: req.session.user,
    });
  }

  try {
    await db("milestones")
      .where({ milestoneid: milestoneId })
      .update({
        milestonetitle,
        milestonedate,
        userid: parseInt(userid, 10),
      });

    res.redirect("/milestones");
  } catch (err) {
    console.error("Update milestone error:", err);
    const users = await getUsersForSelect();
    res.status(500).render("milestones/edit", {
      milestone: {
        milestoneid: milestoneId,
        milestonetitle,
        milestonedate,
        userid,
      },
      users,
      error: "There was a problem updating the milestone.",
      user: req.session.user,
    });
  }
});

// Delete milestone
router.post("/:id/delete", requireAdmin, async (req, res) => {
  const milestoneId = req.params.id;

  try {
    await db("milestones").where({ milestoneid: milestoneId }).del();
    res.redirect("/milestones");
  } catch (err) {
    console.error("Delete milestone error:", err);
    res.status(500).send("Server error");
  }
});

module.exports = router;
