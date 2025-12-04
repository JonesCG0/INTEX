

// Imports database connection pool for the ability to run SQL queries
const pool = require('../db');

// Get and show the donations
// Runs a sql query to get each donation by donationid to populate the table. 
// passes the query to donations and user
// Has error logs
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

// Creates a donation
exports.createDonation = async (req, res) => {
  // Add your create logic here
  res.redirect('/donations');
};

// Deletes a donation by its ID
exports.deleteDonation = async (req, res) => {
  try {
    await pool.query('DELETE FROM donations WHERE donationid = $1', [req.params.id]);
    res.redirect('/donations');
  } catch (err) {
    console.error('Delete donation error:', err);
    res.status(500).send('Server error');
  }
};
