const express = require("express");
const router = express.Router();
const db = require("../db");
const { upload, uploadToS3 } = require("../s3");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { sanitizeText } = require("../utils/validators");

// List users (any logged-in user can see)
router.get("/", requireAdmin, async (req, res) => {
  try {
    const users = await db("users")
      .select("userid", "username", "photo", "userrole as role")
      .orderBy("userid");

    res.render("users/displayUsers", {
      users,
      user: req.session.user,
    });
  } catch (err) {
    console.error("Fetch users error:", err);
    res.status(500).send("Server error");
  }
});

// Add user form - admin only
router.get("/new", requireAdmin, (req, res) => {
  res.render("users/addUser", { error: null, user: req.session.user });
});

// Add user submit - admin only, with photo upload
router.post(
  "/new",
  requireAdmin,
  upload.single("photoFile"),
  async (req, res) => {
    const { username, password, role } = req.body;

    const cleanUsername = sanitizeText(username);
    const cleanPassword = typeof password === "string" ? password.trim() : "";

    if (!cleanUsername || !cleanPassword) {
      return res.render("users/addUser", {
        error: "Username and password are required",
        user: req.session.user,
      });
    }

    const safeRole = role === "A" ? "A" : "U";

    try {
      let photoUrl = null;

      if (req.file) {
        photoUrl = await uploadToS3(req.file);
      }

      await db("users").insert({
        username: cleanUsername,
        password: cleanPassword,
        photo: photoUrl,
        userrole: safeRole,
      });

      res.redirect("/users");
    } catch (err) {
      console.error("Add user error:", err);
      let message = "Server error";
      if (err.code === "23505") {
        message = "Username already exists";
      }
      res.render("users/addUser", { error: message, user: req.session.user });
    }
  }
);

// Edit user form - admin only
router.get("/:userid/edit", requireAdmin, async (req, res) => {
  try {
    const userRecord = await db("users")
      .select("userid", "username", "password", "photo", "userrole as role")
      .where({ userid: req.params.userid })
      .first();

    if (!userRecord) {
      return res.status(404).send("User not found");
    }

    res.render("users/editUser", {
      userRecord,
      error: null,
      user: req.session.user,
    });
  } catch (err) {
    console.error("Get user error:", err);
    res.status(500).send("Server error");
  }
});

// Edit user submit - admin only, optional new photo upload
router.post(
  "/:userid/edit",
  requireAdmin,
  upload.single("photoFile"),
  async (req, res) => {
    const { username, password, existingPhoto, role } = req.body;
    const userid = req.params.userid;

    const cleanUsername = sanitizeText(username);
    const cleanPassword = typeof password === "string" ? password.trim() : "";

    if (!cleanUsername) {
      return res.render("users/editUser", {
        userRecord: { userid, username, photo: existingPhoto, role },
        error: "Username is required",
        user: req.session.user,
      });
    }

    const safeRole = role === "A" ? "A" : "U";

    try {
      let photoUrl = existingPhoto || null;

      if (req.file) {
        photoUrl = await uploadToS3(req.file);
      }

      const updateData = {
        username: cleanUsername,
        photo: photoUrl,
        userrole: safeRole,
      };

      if (cleanPassword) {
        updateData.password = cleanPassword;
      }

      await db("users").where({ userid }).update(updateData);

      res.redirect("/users");
    } catch (err) {
      console.error("Update user error:", err);
      res.status(500).send("Server error");
    }
  }
);

// Delete user - admin only
router.post("/:userid/delete", requireAdmin, async (req, res) => {
  const userid = req.params.userid;

  try {
    await db("users").where({ userid }).del();
    res.redirect("/users");
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).send("Server error");
  }
});

module.exports = router;
