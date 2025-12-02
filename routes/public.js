const express = require("express");
const router = express.Router();

// Home / Landing page
router.get("/", (req, res) => {
  res.render("landing", { user: req.session.user || null });
});

// Video page - accessible to anyone
router.get("/video", (req, res) => {
  res.render("video", {
    user: req.session.user || null,
    youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", // change to your link
  });
});

router.get("/support", (req, res) => {
  res.render("support", {
    user: req.session.user || null,
  });
});

// Easter egg: 418 I'm a teapot
router.get("/teapot", (req, res) => {
  res.status(418).render("teapot");
});

module.exports = router;
