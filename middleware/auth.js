// Only allow the user access if they are logged in. 
// if there is no user oged in then redirect them to the login. 
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  next();
}

// Only allows acces if the user is an admin when then log in. 
// if they are not an admin it will block their access. 
function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).send('Forbidden: Admins only');
  }
  next();
}

// exports these functions so that other files can use them. 
module.exports = { requireAuth, requireAdmin };
