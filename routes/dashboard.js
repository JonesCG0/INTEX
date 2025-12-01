const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

// Dashboard
router.get('/', requireAuth, async (req, res) => {
  try {
    // Fetch summary statistics
    const participantCount = await pool.query('SELECT COUNT(*) as count FROM participants');
    const eventCount = await pool.query('SELECT COUNT(*) as count FROM events');
    const donationSum = await pool.query('SELECT SUM(amount) as total FROM donations');

    res.render('dashboard', {
      participantCount: participantCount.rows[0].count,
      eventCount: eventCount.rows[0].count,
      donationTotal: donationSum.rows[0].total || 0,
      user: req.session.user
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).send('Server error');
  }
});

module.exports = router;
