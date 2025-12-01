require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();

// ---------- EXPRESS SETUP ----------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false
  })
);

// ---------- IMPORT ROUTES ----------
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const participantsRoutes = require('./routes/participants');
const eventsRoutes = require('./routes/events');
const surveysRoutes = require('./routes/surveys');
const milestonesRoutes = require('./routes/milestones');
const donationsRoutes = require('./routes/donations');
const dashboardRoutes = require('./routes/dashboard');
const publicRoutes = require('./routes/public');

// ---------- USE ROUTES ----------
app.use('/auth', authRoutes);
app.use('/users', usersRoutes);
app.use('/participants', participantsRoutes);
app.use('/events', eventsRoutes);
app.use('/surveys', surveysRoutes);
app.use('/milestones', milestonesRoutes);
app.use('/donations', donationsRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/', publicRoutes);

// ---------- START SERVER ----------
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running http://localhost:${PORT}`);
});
