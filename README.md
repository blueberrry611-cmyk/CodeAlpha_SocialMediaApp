# CodeAlpha_SocialMediaApp

Mini social media platform built for the **CodeAlpha Full Stack Development Internship – Task 2**.

## Features
- **User profiles:** name, @username, bio (editable), post / follower / following counts
- **Posts:** create (max 280 characters) and delete your own posts
- **Comments:** comment on any post, delete your own comments
- **Likes:** like / unlike posts
- **Follow system:** follow / unfollow people; a "Following" feed shows posts from people you follow
- **Find people:** search users by name or username
- Registration and login (passwords hashed with scrypt, cookie sessions)
- Database storing users, posts, comments, likes and followers

## Tech stack
- **Frontend:** HTML, CSS, vanilla JavaScript
- **Backend:** Node.js + Express.js
- **Database:** JSON file at `data/db.json` (auto-created; seeded with 3 demo users)

## How to run
1. Install [Node.js](https://nodejs.org) (version 16 or newer).
2. Open a terminal in this folder and run:
   ```bash
   npm install
   npm start
   ```
3. Open **http://localhost:3000** in your browser.

To use another port: `PORT=4000 npm start` (Mac/Linux) or `set PORT=4000 && npm start` (Windows cmd).
To reset all data, stop the server and delete the `data` folder.

## Demo accounts
Password for all: `demo123`

| Username | Name |
|---|---|
| alice | Alice Sharma |
| bob | Bob Verma |
| carol | Carol Singh |

Or sign up with your own account.

## API
| Method | Route | Description |
|---|---|---|
| POST | /api/register | Create account |
| POST | /api/login | Log in (username or email) |
| POST | /api/logout | Log out |
| GET | /api/me | Current user |
| POST | /api/me/profile | Update my name and bio |
| GET | /api/users?q= | Search users / suggestions |
| GET | /api/users/:username | Profile, stats and posts |
| POST | /api/users/:username/follow | Follow / unfollow (toggle) |
| GET | /api/feed?scope=all\|following | Post feed |
| POST | /api/posts | Create post |
| GET | /api/posts/:id | One post |
| DELETE | /api/posts/:id | Delete my post |
| POST | /api/posts/:id/like | Like / unlike (toggle) |
| GET | /api/posts/:id/comments | List comments |
| POST | /api/posts/:id/comments | Add comment |
| DELETE | /api/comments/:id | Delete my comment |

## Project structure
```
server.js        Express app and API routes
lib/db.js        JSON-file database
lib/auth.js      Password hashing and sessions
lib/seed.js      Demo users and posts
public/          Frontend pages, CSS and JS
```
