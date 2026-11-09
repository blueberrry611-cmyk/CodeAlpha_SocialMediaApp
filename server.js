const path = require('path');
const express = require('express');
const db = require('./lib/db');
const auth = require('./lib/auth');
require('./lib/seed').run();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '100kb' }));
app.use(auth.loadUser);
app.use(express.static(path.join(__dirname, 'public')));

const MAX_POST = 280;
const MAX_COMMENT = 200;

const clean = (v, max) => String(v === undefined || v === null ? '' : v).trim().slice(0, max || 200);
const userById = (id) => db.data.users.find((u) => u.id === id);
const userByName = (name) => db.data.users.find((u) => u.username === String(name || '').toLowerCase());
const publicUser = (u) => ({ id: u.id, username: u.username, name: u.name, bio: u.bio || '', createdAt: u.createdAt });
const miniUser = (u) => ({ username: u.username, name: u.name });

function isFollowing(followerId, followingId) {
  return db.data.follows.some((f) => f.followerId === followerId && f.followingId === followingId);
}

function serializePost(p, viewer) {
  const author = userById(p.userId);
  return {
    id: p.id,
    text: p.text,
    createdAt: p.createdAt,
    author: author ? miniUser(author) : { username: 'deleted', name: 'Deleted user' },
    likeCount: db.data.likes.filter((l) => l.postId === p.id).length,
    commentCount: db.data.comments.filter((c) => c.postId === p.id).length,
    likedByMe: !!viewer && db.data.likes.some((l) => l.postId === p.id && l.userId === viewer.id),
    mine: !!viewer && p.userId === viewer.id
  };
}

function serializeComment(c, viewer) {
  const author = userById(c.userId);
  return {
    id: c.id, postId: c.postId, text: c.text, createdAt: c.createdAt,
    author: author ? miniUser(author) : { username: 'deleted', name: 'Deleted user' },
    mine: !!viewer && c.userId === viewer.id
  };
}

const newestFirst = (a, b) => b.id - a.id;

// ---------- Auth ----------
app.post('/api/register', (req, res) => {
  const body = req.body || {};
  const username = clean(body.username, 30).toLowerCase();
  const name = clean(body.name, 60);
  const email = clean(body.email, 120).toLowerCase();
  const password = String(body.password || '');
  if (!/^[a-z0-9_]{3,20}$/.test(username)) return res.status(400).json({ error: 'Username must be 3-20 characters: letters, numbers or underscore.' });
  if (!name) return res.status(400).json({ error: 'Name is required.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  if (db.data.users.some((u) => u.username === username)) return res.status(409).json({ error: 'That username is taken.' });
  if (db.data.users.some((u) => u.email === email)) return res.status(409).json({ error: 'An account with this email already exists.' });

  const user = {
    id: db.nextId('users'), username, name, bio: '', email,
    passwordHash: auth.hashPassword(password), createdAt: new Date().toISOString()
  };
  db.data.users.push(user);
  db.save();
  auth.setCookie(res, auth.createSession(user.id));
  res.status(201).json({ user: publicUser(user) });
});

app.post('/api/login', (req, res) => {
  const body = req.body || {};
  const id = clean(body.identifier || body.email, 120).toLowerCase();
  const password = String(body.password || '');
  const user = db.data.users.find((u) => u.email === id || u.username === id);
  if (!user || !auth.verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Incorrect username/email or password.' });
  }
  auth.setCookie(res, auth.createSession(user.id));
  res.json({ user: publicUser(user) });
});

app.post('/api/logout', (req, res) => {
  auth.destroySession(req.sessionToken);
  auth.clearCookie(res);
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null });
});

// Edit my profile (display name and bio).
app.post('/api/me/profile', auth.requireAuth, (req, res) => {
  const body = req.body || {};
  const name = clean(body.name, 60);
  const bio = clean(body.bio, 160);
  if (!name) return res.status(400).json({ error: 'Name is required.' });
  req.user.name = name;
  req.user.bio = bio;
  db.save();
  res.json({ user: publicUser(req.user) });
});

// ---------- Users / follow ----------
// Search users, or list suggestions when no query is given.
app.get('/api/users', (req, res) => {
  const q = clean(req.query.q, 40).toLowerCase();
  let list = db.data.users.filter((u) => !req.user || u.id !== req.user.id);
  if (q) list = list.filter((u) => u.username.includes(q) || u.name.toLowerCase().includes(q));
  list = list.slice().sort(newestFirst).slice(0, 10);
  res.json({
    users: list.map((u) => Object.assign(miniUser(u), { bio: u.bio || '', following: !!req.user && isFollowing(req.user.id, u.id) }))
  });
});

app.get('/api/users/:username', (req, res) => {
  const user = userByName(req.params.username);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  const posts = db.data.posts.filter((p) => p.userId === user.id).sort(newestFirst).slice(0, 100);
  res.json({
    user: publicUser(user),
    stats: {
      posts: db.data.posts.filter((p) => p.userId === user.id).length,
      followers: db.data.follows.filter((f) => f.followingId === user.id).length,
      following: db.data.follows.filter((f) => f.followerId === user.id).length
    },
    isMe: !!req.user && req.user.id === user.id,
    isFollowing: !!req.user && isFollowing(req.user.id, user.id),
    posts: posts.map((p) => serializePost(p, req.user))
  });
});

// Toggle follow / unfollow.
app.post('/api/users/:username/follow', auth.requireAuth, (req, res) => {
  const target = userByName(req.params.username);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  if (target.id === req.user.id) return res.status(400).json({ error: "You can't follow yourself." });
  const follows = db.data.follows;
  const idx = follows.findIndex((f) => f.followerId === req.user.id && f.followingId === target.id);
  if (idx >= 0) follows.splice(idx, 1); else follows.push({ followerId: req.user.id, followingId: target.id });
  db.save();
  res.json({
    following: idx < 0,
    followers: follows.filter((f) => f.followingId === target.id).length
  });
});

// ---------- Posts ----------
// scope=all (default) shows everyone; scope=following shows me + people I follow.
app.get('/api/feed', (req, res) => {
  let list = db.data.posts;
  if (req.query.scope === 'following') {
    if (!req.user) return res.status(401).json({ error: 'Please log in first.' });
    const ids = new Set(db.data.follows.filter((f) => f.followerId === req.user.id).map((f) => f.followingId));
    ids.add(req.user.id);
    list = list.filter((p) => ids.has(p.userId));
  }
  res.json({ posts: list.slice().sort(newestFirst).slice(0, 100).map((p) => serializePost(p, req.user)) });
});

app.post('/api/posts', auth.requireAuth, (req, res) => {
  const text = clean(req.body && req.body.text, 1000);
  if (!text) return res.status(400).json({ error: 'Write something first.' });
  if (text.length > MAX_POST) return res.status(400).json({ error: 'Posts can be at most ' + MAX_POST + ' characters.' });
  const post = { id: db.nextId('posts'), userId: req.user.id, text, createdAt: new Date().toISOString() };
  db.data.posts.push(post);
  db.save();
  res.status(201).json({ post: serializePost(post, req.user) });
});

app.get('/api/posts/:id', (req, res) => {
  const post = db.data.posts.find((p) => p.id === Number(req.params.id));
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  res.json({ post: serializePost(post, req.user) });
});

app.delete('/api/posts/:id', auth.requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const post = db.data.posts.find((p) => p.id === id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  if (post.userId !== req.user.id) return res.status(403).json({ error: 'You can only delete your own posts.' });
  db.data.posts = db.data.posts.filter((p) => p.id !== id);
  db.data.comments = db.data.comments.filter((c) => c.postId !== id);
  db.data.likes = db.data.likes.filter((l) => l.postId !== id);
  db.save();
  res.json({ ok: true });
});

// Toggle like / unlike.
app.post('/api/posts/:id/like', auth.requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!db.data.posts.some((p) => p.id === id)) return res.status(404).json({ error: 'Post not found.' });
  const likes = db.data.likes;
  const idx = likes.findIndex((l) => l.postId === id && l.userId === req.user.id);
  if (idx >= 0) likes.splice(idx, 1); else likes.push({ userId: req.user.id, postId: id });
  db.save();
  res.json({ liked: idx < 0, likeCount: likes.filter((l) => l.postId === id).length });
});

// ---------- Comments ----------
app.get('/api/posts/:id/comments', (req, res) => {
  const id = Number(req.params.id);
  if (!db.data.posts.some((p) => p.id === id)) return res.status(404).json({ error: 'Post not found.' });
  const list = db.data.comments.filter((c) => c.postId === id).sort((a, b) => a.id - b.id);
  res.json({ comments: list.map((c) => serializeComment(c, req.user)) });
});

app.post('/api/posts/:id/comments', auth.requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!db.data.posts.some((p) => p.id === id)) return res.status(404).json({ error: 'Post not found.' });
  const text = clean(req.body && req.body.text, 1000);
  if (!text) return res.status(400).json({ error: 'Write a comment first.' });
  if (text.length > MAX_COMMENT) return res.status(400).json({ error: 'Comments can be at most ' + MAX_COMMENT + ' characters.' });
  const comment = { id: db.nextId('comments'), postId: id, userId: req.user.id, text, createdAt: new Date().toISOString() };
  db.data.comments.push(comment);
  db.save();
  res.status(201).json({
    comment: serializeComment(comment, req.user),
    commentCount: db.data.comments.filter((c) => c.postId === id).length
  });
});

app.delete('/api/comments/:id', auth.requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const comment = db.data.comments.find((c) => c.id === id);
  if (!comment) return res.status(404).json({ error: 'Comment not found.' });
  if (comment.userId !== req.user.id) return res.status(403).json({ error: 'You can only delete your own comments.' });
  db.data.comments = db.data.comments.filter((c) => c.id !== id);
  db.save();
  res.json({ ok: true });
});

// Unknown API routes return JSON instead of an HTML page.
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

app.listen(PORT, () => {
  console.log('Social app running at http://localhost:' + PORT);
});
