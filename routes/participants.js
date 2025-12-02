const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

// List all participants
router.get('/', requireAuth, async (req, res) => {
  try {
    const participants = await db('participants')
      .select('*')
      .orderBy('participantid');
    res.render('participants/index', {
      participants,
      user: req.session.user
    });
  } catch (err) {
    console.error('Fetch participants error:', err);
    res.status(500).send('Server error');
  }
});

// New participant form
router.get('/new', requireAuth, (req, res) => {
  res.render('participants/new', { error: null, user: req.session.user });
});

// Create participant
router.post('/new', requireAuth, async (req, res) => {
  // Add your create logic here
  res.redirect('/participants');
});

// Show single participant
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const participant = await db('participants')
      .select('*')
      .where({ participantid: req.params.id })
      .first();

    if (!participant) {
      return res.status(404).send('Participant not found');
    }

    res.render('participants/show', {
      participant,
      user: req.session.user
    });
  } catch (err) {
    console.error('Fetch participant error:', err);
    res.status(500).send('Server error');
  }
});

// Edit participant form
router.get('/:id/edit', requireAuth, async (req, res) => {
  try {
    const participant = await db('participants')
      .select('*')
      .where({ participantid: req.params.id })
      .first();

    if (!participant) {
      return res.status(404).send('Participant not found');
    }

    res.render('participants/edit', {
      participant,
      error: null,
      user: req.session.user
    });
  } catch (err) {
    console.error('Fetch participant error:', err);
    res.status(500).send('Server error');
  }
});

// Update participant
router.post('/:id/edit', requireAuth, async (req, res) => {
  // Add your update logic here
  res.redirect(`/participants/${req.params.id}`);
});

module.exports = router;
