// Tiny JSON-file database: users, posts, comments, likes, follows, sessions.
// Writes are atomic (write temp file, then rename) so the file is never half-written.
const fs = require('fs');
const path = require('path');

const FILE = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'db.json');
const TABLES = ['users', 'posts', 'comments', 'likes', 'follows'];

let data = null;

function empty() {
  return {
    counters: { users: 0, posts: 0, comments: 0 },
    users: [], posts: [], comments: [], likes: [], follows: [],
    sessions: {}
  };
}

function save() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, FILE);
}

function load() {
  if (fs.existsSync(FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
      if (parsed && TABLES.every((t) => Array.isArray(parsed[t]))) {
        parsed.sessions = parsed.sessions || {};
        parsed.counters = Object.assign({ users: 0, posts: 0, comments: 0 }, parsed.counters);
        data = parsed;
        return;
      }
    } catch (e) { /* fall through to reset */ }
    try { fs.renameSync(FILE, FILE + '.corrupt-' + Date.now()); } catch (e) { /* ignore */ }
  }
  data = empty();
  save();
}

load();

module.exports = {
  get data() { return data; },
  save,
  nextId(table) { data.counters[table] = (data.counters[table] || 0) + 1; return data.counters[table]; }
};
