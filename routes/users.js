const express = require('express');
const router = express.Router();
const pool = require('../db');
const { upload, uploadToS3 } = require('../s3');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// List users (any logged-in user can see)
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT userid, username, photo, role FROM users ORDER BY userid'
    );

    res.render('users/displayUsers', {
      users: result.rows,
      user: req.session.user
    });
  } catch (err) {
    console.error('Fetch users error:', err);
    res.status(500).send('Server error');
  }
});

// Add user form - admin only
router.get('/new', requireAdmin, (req, res) => {
  res.render('users/addUser', { error: null, user: req.session.user });
});

// Add user submit - admin only, with photo upload
router.post(
  '/new',
  requireAdmin,
  upload.single('photoFile'),
  async (req, res) => {
    const { username, password, role } = req.body;

    if (!username || !password) {
      return res.render('users/addUser', {
        error: 'Username and password are required',
        user: req.session.user
      });
    }

    const safeRole = role === 'A' ? 'A' : 'U';

    try {
      let photoUrl = null;

      if (req.file) {
        photoUrl = await uploadToS3(req.file);
      }

      await pool.query(
        'INSERT INTO users (username, password, photo, role) VALUES ($1, $2, $3, $4)',
        [username, password, photoUrl, safeRole]
      );

      res.redirect('/users');
    } catch (err) {
      console.error('Add user error:', err);
      let message = 'Server error';
      if (err.code === '23505') {
        message = 'Username already exists';
      }
      res.render('users/addUser', { error: message, user: req.session.user });
    }
  }
);

// Edit user form - admin only
router.get('/:userid/edit', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT userid, username, password, photo, role FROM users WHERE userid = $1',
      [req.params.userid]
    );

    if (result.rows.length === 0) {
      return res.status(404).send('User not found');
    }

    res.render('users/editUser', {
      userRecord: result.rows[0],
      error: null,
      user: req.session.user
    });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).send('Server error');
  }
});

// Edit user submit - admin only, optional new photo upload
router.post(
  '/:userid/edit',
  requireAdmin,
  upload.single('photoFile'),
  async (req, res) => {
    const { username, password, existingPhoto, role } = req.body;
    const userid = req.params.userid;

    if (!username) {
      return res.render('users/editUser', {
        userRecord: { userid, username, photo: existingPhoto, role },
        error: 'Username is required',
        user: req.session.user
      });
    }

    const safeRole = role === 'A' ? 'A' : 'U';

    try {
      let photoUrl = existingPhoto || null;

      if (req.file) {
        photoUrl = await uploadToS3(req.file);
      }

      if (password) {
        await pool.query(
          'UPDATE users SET username = $1, password = $2, photo = $3, role = $4 WHERE userid = $5',
          [username, password, photoUrl, safeRole, userid]
        );
      } else {
        await pool.query(
          'UPDATE users SET username = $1, photo = $2, role = $3 WHERE userid = $4',
          [username, photoUrl, safeRole, userid]
        );
      }

      res.redirect('/users');
    } catch (err) {
      console.error('Update user error:', err);
      res.status(500).send('Server error');
    }
  }
);

// Delete user - admin only
router.post('/:userid/delete', requireAdmin, async (req, res) => {
  const userid = req.params.userid;

  try {
    await pool.query('DELETE FROM users WHERE userid = $1', [userid]);
    res.redirect('/users');
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).send('Server error');
  }
});

module.exports = router;
