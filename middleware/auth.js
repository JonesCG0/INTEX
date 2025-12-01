function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'A') {
    return res.status(403).send('Forbidden: Admins only');
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
