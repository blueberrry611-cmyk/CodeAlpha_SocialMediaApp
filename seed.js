// Adds a few demo accounts and posts the first time the app starts (only if there are no users yet).
const db = require('./db');
const auth = require('./auth');

function run() {
  const d = db.data;
  if (d.users.length) return;

  const now = Date.now();
  const mkUser = (username, name, bio) => {
    const u = {
      id: db.nextId('users'), username, name, bio,
      email: username + '@demo.com', passwordHash: auth.hashPassword('demo123'),
      createdAt: new Date(now - 86400000 * 3).toISOString()
    };
    d.users.push(u);
    return u;
  };
  const alice = mkUser('alice', 'Alice Sharma', 'Coffee, code and long walks.');
  const bob = mkUser('bob', 'Bob Verma', 'Full stack learner. Building things one commit at a time.');
  const carol = mkUser('carol', 'Carol Singh', 'Photographer and traveller.');

  const mkPost = (user, text, minutesAgo) => {
    const p = { id: db.nextId('posts'), userId: user.id, text, createdAt: new Date(now - minutesAgo * 60000).toISOString() };
    d.posts.push(p);
    return p;
  };
  const p1 = mkPost(alice, 'Hello everyone! Excited to be part of this little community.', 600);
  const p2 = mkPost(bob, 'Just finished my first Express.js API. The feeling is unreal!', 300);
  const p3 = mkPost(carol, 'Sunsets are better when shared. What is the best view you have seen?', 120);
  mkPost(alice, 'Tip of the day: write small commits and push often.', 45);

  d.follows.push({ followerId: alice.id, followingId: bob.id }, { followerId: bob.id, followingId: alice.id }, { followerId: carol.id, followingId: alice.id });
  d.likes.push({ userId: bob.id, postId: p1.id }, { userId: alice.id, postId: p2.id }, { userId: carol.id, postId: p2.id }, { userId: alice.id, postId: p3.id });
  d.comments.push(
    { id: db.nextId('comments'), postId: p2.id, userId: alice.id, text: 'Congrats Bob, keep going!', createdAt: new Date(now - 280 * 60000).toISOString() },
    { id: db.nextId('comments'), postId: p3.id, userId: bob.id, text: 'The hills at sunrise, hands down.', createdAt: new Date(now - 100 * 60000).toISOString() }
  );
  db.save();
}

module.exports = { run };
