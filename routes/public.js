const express = require("express");
const router = express.Router();

// Home / Landing page
router.get("/", (req, res) => {
  res.render("landing", { user: req.session.user || null });
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
