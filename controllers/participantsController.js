// Connecting to the database so we can run Queryies
const pool = require('../db');

// Get the participants and display them on the participants/index page
exports.getAllParticipants = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM participants ORDER BY participantid');
    res.render('participants/index', {
      participants: result.rows,
      user: req.session.user
    });
  } catch (err) {
    console.error('Fetch participants error:', err);
    res.status(500).send('Server error');
  }
};

// Get a single participant and show their details
exports.getParticipantById = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM participants WHERE participantid = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send('Participant not found');
    }

    res.render('participants/show', {
      participant: result.rows[0],
      user: req.session.user
    });
  } catch (err) {
    console.error('Fetch participant error:', err);
    res.status(500).send('Server error');
  }
};

// Create a new participant
exports.createParticipant = async (req, res) => {
  // Add your create logic here
  res.redirect('/participants');
};

// Update a participants information
exports.updateParticipant = async (req, res) => {
  // Add your update logic here
  res.redirect(`/participants/${req.params.id}`);
};

// Delete a participant
exports.deleteParticipant = async (req, res) => {
  try {
    await pool.query('DELETE FROM participants WHERE participantid = $1', [req.params.id]);
    res.redirect('/participants');
  } catch (err) {
    console.error('Delete participant error:', err);
    res.status(500).send('Server error');
  }
};
