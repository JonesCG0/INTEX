const pool = require('../db');

exports.getAllEvents = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM events ORDER BY eventid');
    res.render('events/index', {
      events: result.rows,
      user: req.session.user
    });
  } catch (err) {
    console.error('Fetch events error:', err);
    res.status(500).send('Server error');
  }
};

exports.getEventById = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM events WHERE eventid = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send('Event not found');
    }

    res.render('events/show', {
      event: result.rows[0],
      user: req.session.user
    });
  } catch (err) {
    console.error('Fetch event error:', err);
    res.status(500).send('Server error');
  }
};

exports.createEvent = async (req, res) => {
  // Add your create logic here
  res.redirect('/events');
};

exports.updateEvent = async (req, res) => {
  // Add your update logic here
  res.redirect(`/events/${req.params.id}`);
};

exports.deleteEvent = async (req, res) => {
  try {
    await pool.query('DELETE FROM events WHERE eventid = $1', [req.params.id]);
    res.redirect('/events');
  } catch (err) {
    console.error('Delete event error:', err);
    res.status(500).send('Server error');
  }
};
