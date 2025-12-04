/**
 * Lightweight flash message middleware inspired by connect-flash.
 * Stores arrays of messages on the session, exposes req.flash() API.
 */
function flashMiddleware() {
  return function flash(req, res, next) {
    if (!req.session) {
      throw new Error("Flash messages require sessions. Did you forget express-session?");
    }

    // Load any queued messages from the previous request cycle.
    const stored = req.session.flash || {};
    delete req.session.flash;

    /**
     * req.flash(type, msg) -> push message
     * req.flash(type) -> popped array of messages
     * req.flash() -> popped object with all messages
     */
    req.flash = function flashFn(type, msg) {
      if (arguments.length === 0) {
        const all = { ...stored };
        Object.keys(stored).forEach((key) => delete stored[key]);
        return all;
      }

      if (msg === undefined) {
        const messages = stored[type] || [];
        delete stored[type];
        return messages;
      }

      if (!req.session.flash) {
        req.session.flash = {};
      }
      if (!Array.isArray(req.session.flash[type])) {
        req.session.flash[type] = [];
      }
      req.session.flash[type].push(msg);
      return req.session.flash[type].length;
    };

    next();
  };
}

module.exports = flashMiddleware;
