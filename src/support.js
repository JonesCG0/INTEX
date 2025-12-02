require("dotenv").config();

const express = require("express");
const session = require("express-session");
const path = require("path");
const db = require("../db");
const multer = require("multer");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const app = express();

// ---------- S3 + UPLOAD SETUP ----------
const S3_BUCKET = process.env.S3_BUCKET;
const AWS_REGION = process.env.AWS_REGION || "us-east-2";

const s3 = new S3Client({ region: AWS_REGION });

// store uploaded files in memory, then push to S3
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

async function uploadToS3(file) {
  if (!file) return null;

  // if no bucket configured (e.g. local dev), skip S3
  if (!S3_BUCKET) {
    console.log("No S3_BUCKET set; skipping S3 upload.");
    return null;
  }

  const safeName = file.originalname.replace(/\s+/g, "_");
  const key = `users/${Date.now()}_${safeName}`;

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  });

  await s3.send(command);

  return `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`;
}

// ---------- EXPRESS SETUP ----------
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));

app.use(express.static(path.join(__dirname, "..", "public")));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret",
    resave: false,
    saveUninitialized: false,
  })
);

// ---------- AUTH MIDDLEWARE ----------
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/auth/login");
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== "A") {
    return res.status(403).send("Forbidden: Admins only");
  }
  next();
}

// Mount routers
const eventsRouter = require("../routes/events");
const participantsRouter = require("../routes/participants");
const milestonesRouter = require("../routes/milestones");
const dashboardRouter = require("../routes/dashboard");
const donationsRouter = require("../routes/donations");
const surveysRouter = require("../routes/surveys");

app.use("/events", eventsRouter);
app.use("/participants", participantsRouter);
app.use("/milestones", milestonesRouter);
app.use("/dashboard", dashboardRouter);
app.use("/donations", donationsRouter);
app.use("/surveys", surveysRouter);

// ---------- ROUTES ----------

// Home
app.get("/", async (req, res) => {
  try {
    // Fetch counts from database
    const [participantCount] = await db("participants").count("* as count");
    const [eventCount] = await db("eventoccurrences").count("* as count");
    const [milestoneCount] = await db("milestones").count("* as count");
    const donationSum = await db("donationTotals")
      .select(db.raw("SUM(CAST(totalDonationCalculated AS DECIMAL)) as total"))
      .first();

    res.render("landing", {
      user: req.session.user || null,
      stats: {
        participants: participantCount.count,
        events: eventCount.count,
        milestones: milestoneCount.count,
        donations: donationSum.total || 0,
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

// Login form
app.get("/auth/login", (req, res) => {
  res.render("auth/login", { error: null });
});

// Login submit
app.post("/auth/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await db('users')
      .select('userid', 'username', 'password', 'photo', 'role')
      .where({ username, password })
      .first();

    if (!user) {
      return res.render("auth/login", {
        error: "Invalid username or password",
      });
    }

    req.session.user = {
      userid: user.userid,
      username: user.username,
      role: user.role,
      photo: user.photo,
    };

    res.redirect("/");
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).send("Server error");
  }
});

// Logout
app.get("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/auth/login");
  });
});

// List users (any logged-in user can see)
app.get("/users", requireAuth, async (req, res) => {
  try {
    const users = await db('users')
      .select('userid', 'username', 'photo', 'role')
      .orderBy('userid');

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
app.get("/users/new", requireAdmin, (req, res) => {
  res.render("addUser", { error: null, user: req.session.user });
});

// Add user form - admin only
app.get("/users/new", requireAdmin, (req, res) => {
  res.render("addUser", { error: null, user: req.session.user });
});

// Add user submit - admin only, with photo upload
app.post(
  "/users/new",
  requireAdmin,
  upload.single("photoFile"),
  async (req, res) => {
    const { username, password, role } = req.body;

    if (!username || !password) {
      return res.render("addUser", {
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

      await db('users').insert({
        username,
        password,
        photo: photoUrl,
        role: safeRole
      });

      res.redirect("/users");
    } catch (err) {
      console.error("Add user error:", err);
      let message = "Server error";
      if (err.code === "23505") {
        message = "Username already exists";
      }
      res.render("addUser", { error: message, user: req.session.user });
    }
  }
);

// Edit user form - admin only
app.get("/users/:userid/edit", requireAdmin, async (req, res) => {
  try {
    const userRecord = await db('users')
      .select('userid', 'username', 'password', 'photo', 'role')
      .where({ userid: req.params.userid })
      .first();

    if (!userRecord) {
      return res.status(404).send("User not found");
    }

    res.render("editUser", {
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
app.post(
  "/users/:userid/edit",
  requireAdmin,
  upload.single("photoFile"),
  async (req, res) => {
    const { username, password, existingPhoto, role } = req.body;
    const userid = req.params.userid;

    if (!username) {
      return res.render("editUser", {
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
        username,
        photo: photoUrl,
        role: safeRole
      };

      if (password) {
        updateData.password = password;
      }

      await db('users')
        .where({ userid })
        .update(updateData);

      res.redirect("/users");
    } catch (err) {
      console.error("Update user error:", err);
      res.status(500).send("Server error");
    }
  }
);

// Delete user - admin only
app.post("/users/:userid/delete", requireAdmin, async (req, res) => {
  const userid = req.params.userid;

  try {
    await db('users')
      .where({ userid })
      .del();
    res.redirect("/users");
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).send("Server error");
  }
});

// Video page - accessible to anyone
app.get("/video", (req, res) => {
  res.render("video", {
    user: req.session.user || null,
    youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", // change to your link
  });
});

// Support Us page - accessible to anyone
app.get("/support", (req, res) => {
  res.render("support", {
    user: req.session.user || null,
  });
});
