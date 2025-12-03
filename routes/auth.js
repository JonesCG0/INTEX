const express = require('express');
const router = express.Router();
const db = require('../db');
const {
  hasText,
  sanitizeText,
  sanitizeEmail,
  sanitizePhone,
  sanitizeZip,
  sanitizeISODate
} = require('../utils/validators');
const { hashPassword, verifyPassword } = require('../utils/passwords');

function ensureValidRole(role) {
  if (typeof role !== 'string') {
    return null;
  }

  const normalized = role.trim().toLowerCase();
  if (normalized === 'admin' || normalized === 'participant') {
    return normalized;
  }

  return null;
}

// Login form
router.get('/login', (req, res) => {
  res.render('auth/login', { error: null });
});

// Login submit
router.post('/login', async (req, res) => {
  const cleanUsername = sanitizeText(req.body.username);
  const cleanPassword = typeof req.body.password === 'string' ? req.body.password.trim() : '';

  if (!cleanUsername || !cleanPassword) {
    return res.render('auth/login', { error: 'Username and password are required' });
  }

  try {
    const user = await db('users')
      .select('userid', 'username', 'password', 'photo', 'userrole as role')
      .where({ username: cleanUsername })
      .first();

    if (!user) {
      return res.render('auth/login', { error: 'Invalid username or password' });
    }

    const validPassword = await verifyPassword(cleanPassword, user.password);
    if (!validPassword) {
      return res.render('auth/login', { error: 'Invalid username or password' });
    }

    const validRole = ensureValidRole(user.role);
    if (!validRole) {
      console.warn('User has unsupported role value', { userid: user.userid, role: user.role });
      return res.render('auth/login', { error: 'Invalid username or password' });
    }

    req.session.user = {
      userid: user.userid,
      username: user.username,
      role: validRole,
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
  const {
    username,
    password,
    confirmPassword,
    participantGuardianFirstName,
    participantGuardianLastName,
    participantGuardianEmail,
    participantFirstName,
    participantLastName,
    participantDOB,
    participantPhone,
    participantCity,
    participantState,
    participantZip
  } = req.body;

  const errors = [];
  const cleanUsername = sanitizeText(username);
  const cleanPassword = typeof password === 'string' ? password.trim() : '';
  const cleanConfirm = typeof confirmPassword === 'string' ? confirmPassword.trim() : '';
  const cleanFirstName = sanitizeText(participantFirstName);
  const cleanLastName = sanitizeText(participantLastName);
  const cleanDOB = sanitizeISODate(participantDOB);
  const cleanPhone = sanitizePhone(participantPhone);
  const cleanCity = sanitizeText(participantCity);
  const cleanState = sanitizeText(participantState);
  const cleanZip = sanitizeZip(participantZip);
  const guardianFirstName = sanitizeText(participantGuardianFirstName);
  const guardianLastName = sanitizeText(participantGuardianLastName);
  let guardianEmail = null;
  if (hasText(participantGuardianEmail)) {
    guardianEmail = sanitizeEmail(participantGuardianEmail);
    if (!guardianEmail) {
      errors.push('Guardian email must be valid');
    }
  }

  if (!cleanUsername) {
    errors.push('Username is required');
  }
  if (!cleanPassword) {
    errors.push('Password is required');
  }
  if (cleanPassword && cleanPassword.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (cleanPassword !== cleanConfirm) {
    errors.push('Passwords do not match');
  }
  if (!cleanFirstName || !cleanLastName) {
    errors.push('Participant first and last name are required');
  }
  if (!cleanDOB) {
    errors.push('Participant birth date must be a valid YYYY-MM-DD value');
  }
  if (!cleanPhone) {
    errors.push('Participant phone number must include at least 10 digits');
  }
  if (!cleanCity || !cleanState) {
    errors.push('Participant city and state are required');
  }
  if (!cleanZip) {
    errors.push('Participant ZIP code must be 5 or 9 digits');
  }

  if (errors.length) {
    return res.status(400).render('auth/signup', { error: errors[0] });
  }

  try {
    const existingUser = await db('users')
      .select('userid')
      .where({ username: cleanUsername })
      .first();

    if (existingUser) {
      return res.render('auth/signup', { error: 'Username already taken' });
    }

    const passwordHash = await hashPassword(cleanPassword);

    const newUserPayload = {
      username: cleanUsername,
      password: passwordHash,
      userrole: 'participant',
      userfirstname: cleanFirstName,
      userlastname: cleanLastName,
      userdob: cleanDOB,
      userphone: cleanPhone,
      usercity: cleanCity,
      userstate: cleanState,
      userzip: cleanZip,
      guardianfirstname: guardianFirstName,
      guardianlastname: guardianLastName,
      guardianemail: guardianEmail,
      useremail: guardianEmail
    };

    const [newUser] = await db('users')
      .insert(newUserPayload)
      .returning(['userid', 'username', 'userrole as role', 'photo']);

    req.session.user = {
      userid: newUser.userid,
      username: newUser.username,
      role: 'participant',
      photo: newUser.photo || null
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
