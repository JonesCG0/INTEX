const express = require("express");
const router = express.Router();
const db = require("../db");
const { upload, uploadToS3 } = require("../s3");
const { hashPassword } = require("../utils/passwords");

// View profile (any logged-in user can view their own profile)
router.get("/", async (req, res) => {
  try {
    const userRecord = await db("users")
      .select()
      .where({ userid: req.session.user.userid })
      .first();

    if (!userRecord) {
      return res.status(404).send("Profile not found");
    }

    res.render("profile/view", {
      userRecord,
      user: req.session.user,
    });
  } catch (err) {
    console.error("Get profile error:", err);
    res.status(500).send("Server error");
  }
});

// Edit profile form (users can edit their own profile)
router.get("/edit", async (req, res) => {
  try {
    const userRecord = await db("users")
      .select("*")
      .where({ userid: req.session.user.userid })
      .first();

    if (!userRecord) {
      return res.status(404).send("Profile not found");
    }

    res.render("profile/edit", {
      userRecord,
      error: null,
      user: req.session.user,
    });
  } catch (err) {
    console.error("Get profile for edit error:", err);
    res.status(500).send("Server error");
  }
});

// Edit profile submit (users can update their own profile)
router.post("/edit", upload.single("photoFile"), async (req, res) => {
  const {
    username,
    password,
    existingPhoto,
    userfirstname,
    userlastname,
    useremail,
    userdob,
    userphone,
    usercity,
    userstate,
    userzip,
    userschooloremployer,
    userfieldofinterest,
    guardianfirstname,
    guardianlastname,
    guardianemail
  } = req.body;

  const userid = req.session.user.userid;
  const cleanUsername = typeof username === "string" ? username.trim() : "";
  const cleanPassword = typeof password === "string" ? password.trim() : "";

  if (!cleanUsername) {
    const userRecord = await db("users")
      .select("*")
      .where({ userid })
      .first();

    return res.render("profile/edit", {
      userRecord,
      error: "Username is required",
      user: req.session.user,
    });
  }

  try {
    let photoUrl = existingPhoto || null;

    if (req.file) {
      photoUrl = await uploadToS3(req.file);
    }

    const updateData = {
      username: cleanUsername,
      photo: photoUrl,
      userfirstname: userfirstname || null,
      userlastname: userlastname || null,
      useremail: useremail || null,
      userdob: userdob || null,
      userphone: userphone || null,
      usercity: usercity || null,
      userstate: userstate || null,
      userzip: userzip || null,
      userschooloremployer: userschooloremployer || null,
      userfieldofinterest: userfieldofinterest || null,
      guardianfirstname: guardianfirstname || null,
      guardianlastname: guardianlastname || null,
      guardianemail: guardianemail || null,
    };

    if (cleanPassword) {
      updateData.password = await hashPassword(cleanPassword);
    }

    await db("users").where({ userid }).update(updateData);

    // Update session with new username and name
    req.session.user.username = cleanUsername;
    if (userfirstname) req.session.user.userfirstname = userfirstname;
    if (userlastname) req.session.user.userlastname = userlastname;

    res.redirect("/profile");
  } catch (err) {
    console.error("Update profile error:", err);
    const userRecord = await db("users")
      .select("*")
      .where({ userid })
      .first();

    let message = "Server error";
    if (err.code === "23505") {
      message = "Username already exists";
    }

    res.render("profile/edit", {
      userRecord,
      error: message,
      user: req.session.user,
    });
  }
});

module.exports = router;
