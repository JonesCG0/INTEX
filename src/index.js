require("dotenv").config();

const express = require("express");
const session = require("express-session");
const path = require("path");
const { Pool } = require("pg");
const multer = require("multer");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const app = express();

// ---------- DATABASE ----------
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
});

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
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "images")));
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
    return res.redirect("/login");
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== "A") {
    return res.status(403).send("Forbidden: Admins only");
  }
  next();
}

// ---------- ROUTES ----------

// Home
app.get("/", (req, res) => {
  res.render("index", { user: req.session.user || null });
});

// Login form
app.get("/auth/login", (req, res) => {
  res.render("auth/login", { error: null });
});

// Login submit
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query(
      "SELECT userid, username, password, photo, role FROM users WHERE username = $1 AND password = $2",
      [username, password]
    );

    if (result.rows.length === 0) {
      return res.render("login", { error: "Invalid username or password" });
    }

    const user = result.rows[0];

    req.session.user = {
      userid: user.userid,
      username: user.username,
      role: user.role,
      photo: user.photo,
    };

    res.redirect("/users");
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).send("Server error");
  }
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

// List users (any logged-in user can see)
app.get("/users", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT userid, username, photo, role FROM users ORDER BY userid"
    );

    res.render("displayUsers", {
      users: result.rows,
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

      await pool.query(
        "INSERT INTO users (username, password, photo, role) VALUES ($1, $2, $3, $4)",
        [username, password, photoUrl, safeRole]
      );

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
    const result = await pool.query(
      "SELECT userid, username, password, photo, role FROM users WHERE userid = $1",
      [req.params.userid]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("User not found");
    }

    res.render("editUser", {
      userRecord: result.rows[0],
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

      if (password) {
        await pool.query(
          "UPDATE users SET username = $1, password = $2, photo = $3, role = $4 WHERE userid = $5",
          [username, password, photoUrl, safeRole, userid]
        );
      } else {
        await pool.query(
          "UPDATE users SET username = $1, photo = $2, role = $3 WHERE userid = $4",
          [username, photoUrl, safeRole, userid]
        );
      }

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
    await pool.query("DELETE FROM users WHERE userid = $1", [userid]);
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

// ---------- START SERVER ----------
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running http://localhost:${PORT}`);
});
