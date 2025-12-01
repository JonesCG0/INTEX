const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

// List all milestones
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM milestones ORDER BY milestoneid');
    res.render('milestones/index', {
      milestones: result.rows,
      user: req.session.user
    });
  } catch (err) {
    console.error('Fetch milestones error:', err);
    res.status(500).send('Server error');
  }
});

// New milestone form
router.get('/new', requireAuth, (req, res) => {
  res.render('milestones/new', { error: null, user: req.session.user });
});

// Create milestone
router.post('/new', requireAuth, async (req, res) => {
  // Add your create logic here
  res.redirect('/milestones');
});

// Assign milestone form
router.get('/assign', requireAuth, (req, res) => {
  res.render('milestones/assign', { error: null, user: req.session.user });
});

// Assign milestone
router.post('/assign', requireAuth, async (req, res) => {
  // Add your assign logic here
  res.redirect('/milestones');
});

module.exports = router;
