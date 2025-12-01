const pool = require('../db');

exports.getAllDonations = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM donations ORDER BY donationid');
    res.render('donations/index', {
      donations: result.rows,
      user: req.session.user
    });
  } catch (err) {
    console.error('Fetch donations error:', err);
    res.status(500).send('Server error');
  }
};

exports.createDonation = async (req, res) => {
  // Add your create logic here
  res.redirect('/donations');
};

exports.deleteDonation = async (req, res) => {
  try {
    await pool.query('DELETE FROM donations WHERE donationid = $1', [req.params.id]);
    res.redirect('/donations');
  } catch (err) {
    console.error('Delete donation error:', err);
    res.status(500).send('Server error');
  }
};
