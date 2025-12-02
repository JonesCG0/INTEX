const express = require('express');
const router = express.Router();
const db = require('../db');

// Login form
router.get('/login', (req, res) => {
  res.render('auth/login', { error: null });
});

// Login submit
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await db('users')
      .select('userid', 'username', 'password', 'photo', 'role')
      .where({ username, password })
      .first();

    if (!user) {
      return res.render('auth/login', { error: 'Invalid username or password' });
    }

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
    const existingUser = await db('users')
      .select('userid')
      .where({ username })
      .first();

    if (existingUser) {
      return res.render('auth/signup', { error: 'Username already taken' });
    }

    // Insert new user with role 'U' (regular user)
    const [newUser] = await db('users')
      .insert({ username, password, role: 'U' })
      .returning(['userid', 'username', 'role']);

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
