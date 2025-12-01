const pool = require('../db');

exports.getAllMilestones = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM milestones ORDER BY milestoneid');
    res.render('milestones/index', {
      milestones: result.rows,
      user: req.session.user
    });
  } catch (err) {
    console.error('Fetch milestones error:', err);
    res.status(500).send('Server error');
  }
};

exports.createMilestone = async (req, res) => {
  // Add your create logic here
  res.redirect('/milestones');
};

exports.assignMilestone = async (req, res) => {
  // Add your assign logic here
  res.redirect('/milestones');
};

exports.deleteMilestone = async (req, res) => {
  try {
    await pool.query('DELETE FROM milestones WHERE milestoneid = $1', [req.params.id]);
    res.redirect('/milestones');
  } catch (err) {
    console.error('Delete milestone error:', err);
    res.status(500).send('Server error');
  }
};
