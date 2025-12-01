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

// Signup form
router.get('/signup', (req, res) => {
  res.render('auth/signup', { error: null });
});

// Signup submit
router.post('/signup', async (req, res) => {
  const { username, password, confirmPassword } = req.body;

  // Validate password match
  if (password !== confirmPassword) {
    return res.render('auth/signup', { error: 'Passwords do not match' });
  }

  try {
    // Check if username already exists
    const existingUser = await pool.query(
      'SELECT userid FROM users WHERE username = $1',
      [username]
    );

    if (existingUser.rows.length > 0) {
      return res.render('auth/signup', { error: 'Username already taken' });
    }

    // Insert new user with role 'U' (regular user)
    const result = await pool.query(
      'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING userid, username, role',
      [username, password, 'U']
    );

    const newUser = result.rows[0];

    // Log them in automatically
    req.session.user = {
      userid: newUser.userid,
      username: newUser.username,
      role: newUser.role,
      photo: null
    };

    res.redirect('/');
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).send('Server error');
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

module.exports = router;
