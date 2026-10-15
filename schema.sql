-- ===================================================================
-- Cloudflare D1 / SQLite Database Schema
-- File: schema.sql
-- Compatible with Cloudflare D1, SQLite 3, and Local Node Server
-- ===================================================================

CREATE TABLE IF NOT EXISTS community_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  verified_type TEXT DEFAULT 'none',
  ip_address TEXT,
  is_admin INTEGER DEFAULT 0,
  is_banned INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS community_messages (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  username TEXT NOT NULL,
  user_avatar TEXT,
  verified_type TEXT DEFAULT 'none',
  content TEXT,
  attachments TEXT,
  media_links TEXT,
  gif_url TEXT,
  reactions TEXT DEFAULT '{}',
  reply_to TEXT,
  is_deleted INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS community_channels (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL,
  creator_name TEXT NOT NULL,
  creator_username TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  join_token TEXT UNIQUE,
  is_private INTEGER DEFAULT 1,
  members TEXT DEFAULT '[]',
  pending_requests TEXT DEFAULT '[]',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS community_notifications (
  id TEXT PRIMARY KEY,
  recipient_username TEXT NOT NULL,
  sender_username TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  type TEXT DEFAULT 'mention',
  channel_id TEXT,
  requester_id TEXT,
  dm_user_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS community_contact_queries (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  user_id TEXT,
  username TEXT,
  social_account_id TEXT,
  message TEXT NOT NULL,
  proof_file_name TEXT,
  proof_file TEXT,
  ip TEXT,
  status TEXT DEFAULT 'pending',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  handle_x TEXT,
  handle_yt TEXT,
  handle_insta TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  other_links TEXT,
  avatar_url TEXT,
  categories TEXT NOT NULL,
  party TEXT,
  institution TEXT,
  narrative TEXT NOT NULL,
  fact_check TEXT,
  proof_url TEXT,
  upvotes INTEGER DEFAULT 0,
  is_verified INTEGER DEFAULT 1,
  submitted_by_ip TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS nationalist_influencers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  handle_x TEXT,
  handle_yt TEXT,
  handle_insta TEXT,
  other_links TEXT,
  avatar_url TEXT,
  category TEXT DEFAULT 'Nationalist Creator',
  description TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  is_verified INTEGER DEFAULT 1,
  submitted_by_ip TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  badge TEXT DEFAULT '🚨 BREAKING ALERT',
  is_pinned INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS blocked_ips (
  ip TEXT PRIMARY KEY,
  reason TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS votes (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  vote_type TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS poll_votes (
  id TEXT PRIMARY KEY,
  poll_id TEXT NOT NULL,
  option_id TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS visit_traffic (
  id TEXT PRIMARY KEY,
  ip TEXT NOT NULL,
  page TEXT NOT NULL,
  user_agent TEXT,
  country TEXT,
  created_at TEXT NOT NULL
);

-- Seed Default Admin
INSERT OR IGNORE INTO community_users (
  id, name, username, email, phone, password_hash, avatar_url, verified_type, ip_address, is_admin, is_banned, created_at, updated_at
) VALUES (
  'usr_admin_master', 'Om Kumar (Admin)', 'omkumar', 'omkumar.working@gmail.com', '+919999999999', 'Q0gng04bk3', 'https://api.dicebear.com/7.x/bottts/svg?seed=omkumar', 'influencer', '127.0.0.1', 1, 0, '2026-10-15T00:00:00.000Z', '2026-10-15T00:00:00.000Z'
);

-- Seed Public Community Welcome Message
INSERT OR IGNORE INTO community_messages (
  id, channel_id, user_id, user_name, username, user_avatar, verified_type, content, attachments, media_links, gif_url, reactions, reply_to, is_deleted, created_at
) VALUES (
  'msg_welcome_1', 'public', 'usr_admin_master', 'Om Kumar (Admin)', 'omkumar', 'https://api.dicebear.com/7.x/bottts/svg?seed=omkumar', 'influencer', '🇮🇳 Welcome to the Sovereign Citizen Community! Connect, speak truth, share insights, and organize freely. Jai Hind, Bharat Mata ki Jai! 🚩', '[]', '[]', NULL, '{"🇮🇳":[{"user_id":"usr_admin_master","username":"omkumar"}]}', NULL, 0, '05:30 AM'
);
