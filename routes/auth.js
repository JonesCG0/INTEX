const express = require('express');
const router = express.Router();
const pool = require('../db');

// Login form
router.get('/login', (req, res) => {
  res.render('auth/login', { error: null });
});

// Login submit
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query(
      'SELECT userid, username, password, photo, role FROM users WHERE username = $1 AND password = $2',
      [username, password]
    );

    if (result.rows.length === 0) {
      return res.render('auth/login', { error: 'Invalid username or password' });
    }

    const user = result.rows[0];

    req.session.user = {
      userid: user.userid,
      username: user.username,
      role: user.role,
      photo: user.photo
    };

    res.redirect('/');
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).send('Server error');
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/auth/login');
  });
});

module.exports = router;
