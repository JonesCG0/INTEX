const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

// List all surveys
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM surveys ORDER BY surveyid');
    res.render('surveys/index', {
      surveys: result.rows,
      user: req.session.user
    });
  } catch (err) {
    console.error('Fetch surveys error:', err);
    res.status(500).send('Server error');
  }
});

// New survey form
router.get('/new', requireAuth, (req, res) => {
  res.render('surveys/new', { error: null, user: req.session.user });
});

// Create survey
router.post('/new', requireAuth, async (req, res) => {
  // Add your create logic here
  res.redirect('/surveys');
});

// Show single survey
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM surveys WHERE surveyid = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send('Survey not found');
    }

    res.render('surveys/show', {
      survey: result.rows[0],
      user: req.session.user
    });
  } catch (err) {
    console.error('Fetch survey error:', err);
    res.status(500).send('Server error');
  }
});

module.exports = router;
