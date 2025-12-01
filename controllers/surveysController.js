const pool = require('../db');

exports.getAllSurveys = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM surveys ORDER BY surveyid');
    res.render('surveys/index', {
      surveys: result.rows,
      user: req.session.user
    });
  } catch (err) {
    console.error('Fetch surveys error:', err);
    res.status(500).send('Server error');
  }
};

exports.getSurveyById = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM surveys WHERE surveyid = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send('Survey not found');
    }

    res.render('surveys/show', {
      survey: result.rows[0],
      user: req.session.user
    });
  } catch (err) {
    console.error('Fetch survey error:', err);
    res.status(500).send('Server error');
  }
};

exports.createSurvey = async (req, res) => {
  // Add your create logic here
  res.redirect('/surveys');
};

exports.deleteSurvey = async (req, res) => {
  try {
    await pool.query('DELETE FROM surveys WHERE surveyid = $1', [req.params.id]);
    res.redirect('/surveys');
  } catch (err) {
    console.error('Delete survey error:', err);
    res.status(500).send('Server error');
  }
};
