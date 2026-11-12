'use strict';

const session = require('express-session');

/** Paprasta express-session saugykla SQLite lentelėje `sessions`. */
class SqliteStore extends session.Store {
  constructor(db, { ttlMs = 7 * 24 * 60 * 60 * 1000 } = {}) {
    super();
    this.ttlMs = ttlMs;
    this.stmt = {
      get: db.prepare('SELECT data FROM sessions WHERE sid = ? AND expires > ?'),
      set: db.prepare(
        'INSERT INTO sessions (sid, data, expires) VALUES (?, ?, ?) ' +
          'ON CONFLICT(sid) DO UPDATE SET data = excluded.data, expires = excluded.expires'
      ),
      touch: db.prepare('UPDATE sessions SET expires = ? WHERE sid = ?'),
      destroy: db.prepare('DELETE FROM sessions WHERE sid = ?'),
      prune: db.prepare('DELETE FROM sessions WHERE expires <= ?'),
    };
    this.timer = setInterval(() => this.stmt.prune.run(Date.now()), 60 * 60 * 1000);
    this.timer.unref();
  }

  expiry(sess) {
    const exp = sess && sess.cookie && sess.cookie.expires;
    return exp ? new Date(exp).getTime() : Date.now() + this.ttlMs;
  }

  get(sid, cb) {
    try {
      const row = this.stmt.get.get(sid, Date.now());
      cb(null, row ? JSON.parse(row.data) : null);
    } catch (err) {
      cb(err);
    }
  }

  set(sid, sess, cb) {
    try {
      this.stmt.set.run(sid, JSON.stringify(sess), this.expiry(sess));
      cb && cb(null);
    } catch (err) {
      cb && cb(err);
    }
  }

  touch(sid, sess, cb) {
    try {
      this.stmt.touch.run(this.expiry(sess), sid);
      cb && cb(null);
    } catch (err) {
      cb && cb(err);
    }
  }

  destroy(sid, cb) {
    try {
      this.stmt.destroy.run(sid);
      cb && cb(null);
    } catch (err) {
      cb && cb(err);
    }
  }
}

module.exports = SqliteStore;
