// Password hashing (scrypt) and cookie sessions, using only Node's built-in crypto.
const crypto = require('crypto');
const db = require('./db');

const SESSION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const COOKIE = 'sid';

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return salt + ':' + hash;
}

function verifyPassword(password, stored) {
  const parts = String(stored).split(':');
  if (parts.length !== 2) return false;
  const expected = Buffer.from(parts[1], 'hex');
  const actual = crypto.scryptSync(password, parts[0], 64);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function parseCookies(header) {
  const out = {};
  String(header || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const sessions = db.data.sessions;
  const now = Date.now();
  Object.keys(sessions).forEach((t) => { if (sessions[t].expires < now) delete sessions[t]; });
  sessions[token] = { userId, expires: now + SESSION_MS };
  db.save();
  return token;
}

function destroySession(token) {
  if (token && db.data.sessions[token]) {
    delete db.data.sessions[token];
    db.save();
  }
}

function setCookie(res, token) {
  res.setHeader('Set-Cookie', COOKIE + '=' + token + '; HttpOnly; SameSite=Lax; Path=/; Max-Age=' + Math.floor(SESSION_MS / 1000));
}

function clearCookie(res) {
  res.setHeader('Set-Cookie', COOKIE + '=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
}

// Middleware: attaches req.user (or null) and req.sessionToken.
function loadUser(req, res, next) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  const session = token && db.data.sessions[token];
  req.user = null;
  req.sessionToken = null;
  if (session && session.expires > Date.now()) {
    const user = db.data.users.find((u) => u.id === session.userId);
    if (user) { req.user = user; req.sessionToken = token; }
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please log in first.' });
  next();
}

module.exports = { hashPassword, verifyPassword, createSession, destroySession, setCookie, clearCookie, loadUser, requireAuth };
