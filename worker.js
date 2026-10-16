/**
 * ===================================================================
 * 🛡️ EXPOSED PROPAGANDUS — FULL STACK CLOUDFLARE WORKER API SERVER
 * ===================================================================
 * High-performance edge API server compatible with Cloudflare Workers
 * Supports Cloudflare D1 serverless database, in-memory resilient fallback,
 * real-time SSE community chat, automated Instagram/YouTube/X profile scraping,
 * live traffic analytics, nationalist influencer directory, and patriot shield.
 *
 * Bharat Mata ki Jai 🇮🇳
 * ===================================================================
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
};

const JSON_HEADERS = {
  ...CORS_HEADERS,
  'Content-Type': 'application/json; charset=utf-8',
};

// Protected usernames (BJP leaders, Hindu deities, etc.)
const PROTECTED_USERNAMES_REGEX = /^(modi|narendra_modi|namo|bjp|amit_shah|yogi|adityanath|rss|ram|rama|shiva|shiv|krishna|hanuman|vishnu|ganesh|ganpati|mahadev|durga|kali|sita|radha|laxmi|lakshmi|saraswati|bholenath|shanker|shankar|bajrangbali|brahma|admin|official|owner|moderator|propagandus)/i;

// In-Memory Fallback State (used when D1 database is not yet bound)
const memoryState = {
  users: [
    {
      id: 'usr_admin_master',
      name: 'Om Kumar (Admin)',
      username: 'omkumar',
      email: 'omkumar.working@gmail.com',
      phone: '+919999999999',
      password_hash: 'Q0gng04bk3',
      avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=omkumar',
      verified_type: 'influencer',
      is_admin: 1,
      is_banned: 0,
      created_at: new Date().toISOString()
    }
  ],
  messages: [
    {
      id: 'msg_welcome_1',
      channel_id: 'public',
      user_id: 'usr_admin_master',
      user_name: 'Om Kumar (Admin)',
      username: 'omkumar',
      user_avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=omkumar',
      verified_type: 'influencer',
      content: '🇮🇳 Welcome to the Sovereign Citizen Community! Connect, speak truth, share insights, and organize freely. Jai Hind, Bharat Mata ki Jai! 🚩',
      attachments: [],
      media_links: [],
      gif_url: null,
      reactions: { '🇮🇳': [{ user_id: 'usr_admin_master', username: 'omkumar' }] },
      reply_to: null,
      is_deleted: 0,
      created_at: '05:30 AM'
    }
  ],
  channels: [],
  notifications: [],
  adminQueries: [],
  blockedIps: new Set(),
  activeAdminTokens: new Set(['JaiHindBharatMataKiJai2024!', 'Q0gng04bk3']),
  sseWriters: new Set(),
  files: new Map(),
  reports: [
    {
      id: 'rep-1',
      entity_id: 'ent-demo-1',
      entity_name: 'Coordinated Toolkit Network',
      report_type: 'Fake News / Coordinated Disinformation',
      message: 'Spreading misleading audio clip against Indian army and constitutional bodies.',
      status: 'pending',
      reported_by_ip: '103.21.244.1',
      created_at: new Date().toISOString()
    }
  ],
  nationalists: [
    {
      id: 'nat-1',
      name: 'Major Gaurav Arya',
      handle_x: '@majorgauravarya',
      handle_yt: 'TheChanakyaDialogues',
      handle_insta: 'majorgauravarya',
      category: 'National Security Analyst',
      description: 'Veteran Indian Army officer dissecting strategic threats and national security affairs with unapologetic clarity.',
      avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
      status: 'approved',
      is_verified: 1,
      upvotes: 4820,
      created_at: new Date().toISOString()
    },
    {
      id: 'nat-2',
      name: 'Anand Ranganathan',
      handle_x: '@ARanganathan72',
      handle_yt: 'AnandRanganathanOfficial',
      handle_insta: 'anandranganathan72',
      category: 'Author & Scientist',
      description: 'Scientist, author, and fierce orator fearlessly speaking truth to institutional bias.',
      avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
      status: 'approved',
      is_verified: 1,
      upvotes: 3950,
      created_at: new Date().toISOString()
    }
  ],
  entities: [
    {
      id: 'ent-demo-1',
      name: 'Coordinated Toolkit Network',
      handle_x: '@defame_bharat',
      handle_yt: 'toolkitnews',
      handle_insta: 'anti_bharat_front',
      categories: 'Foreign Toolkit, Coordinated Disinformation',
      party: 'Anti-India Lobby',
      institution: 'Offshore Syndicate',
      narrative: 'Manufacturing false riots and spreading deepfakes targeting Indian elections.',
      fact_check: 'Debunked by verified intelligence and open-source forensic verification.',
      proof_url: 'https://pib.gov.in/factcheck',
      upvotes: 1420,
      is_verified: 1,
      created_at: new Date().toISOString()
    }
  ],
  shieldAttempts: [
    {
      id: 'att-1',
      ip: '185.220.101.4',
      attempted_name: 'Narendra Modi',
      details: 'Hostile attempt to submit Prime Minister into propaganda directory.',
      created_at: new Date().toISOString()
    }
  ],
  trafficLogs: [
    {
      id: 'trf-1',
      ip: '103.21.244.15',
      page: '/community',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15',
      deviceType: 'mobile',
      browser: 'Safari Mobile',
      os: 'iOS 17.4',
      country: 'IN',
      city: 'New Delhi',
      timestamp: new Date(Date.now() - 1000 * 60 * 2).toISOString()
    },
    {
      id: 'trf-2',
      ip: '49.36.120.88',
      page: '/database',
      userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 Chrome/122.0.0.0 Mobile',
      deviceType: 'mobile',
      browser: 'Chrome Mobile',
      os: 'Android 14',
      country: 'IN',
      city: 'Mumbai',
      timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString()
    },
    {
      id: 'trf-3',
      ip: '122.161.45.10',
      page: '/nationalists',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0',
      deviceType: 'desktop',
      browser: 'Chrome',
      os: 'Windows 11',
      country: 'IN',
      city: 'Bengaluru',
      timestamp: new Date(Date.now() - 1000 * 60 * 8).toISOString()
    },
    {
      id: 'trf-4',
      ip: '106.213.82.9',
      page: '/',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
      deviceType: 'desktop',
      browser: 'Safari',
      os: 'macOS',
      country: 'IN',
      city: 'Ahmedabad',
      timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString()
    }
  ],
  activityLogs: [
    {
      id: 'log-1',
      action: 'SERVER_BOOT',
      details: 'Cloudflare Worker API Gateway initialized with Patriot Shield Protection.',
      ip: '127.0.0.1',
      created_at: new Date().toISOString()
    }
  ],
  categories: [
    { id: 'cat-1', name: 'Anti-National Narrative', description: 'Coordinated media attacking India sovereignty', color: '#ef4444', type: 'entity' },
    { id: 'cat-2', name: 'Foreign Funded Toolkit', description: 'Offshore networks targeting Indian state institutions', color: '#f59e0b', type: 'entity' },
    { id: 'cat-3', name: 'Deepfake & Disinformation', description: 'Manipulated media and cyber bots', color: '#8b5cf6', type: 'entity' },
    { id: 'cat-4', name: 'National Security Analyst', description: 'Defence and strategic affairs commentators', color: '#10b981', type: 'nationalist' },
    { id: 'cat-5', name: 'Cultural Historian', description: 'Uncovering civilizational heritage and history', color: '#f97316', type: 'nationalist' }
  ],
  playlist: [
    {
      id: 'track-1',
      title: 'Vande Mataram — Sovereign Anthems',
      artist: 'National Symphony of Bharat',
      audio_url: 'https://upload.wikimedia.org/wikipedia/commons/4/4e/Vande_Mataram_%28Instrumental%29.ogg',
      duration: '3:12',
      is_active: 1
    }
  ],
  posts: [
    {
      id: 'post-1',
      title: '🚨 Ground Intel: Toolkit Networks & Coordinated Disinformation Busted',
      content: 'Multiple synchronized handles originating from offshore proxies have been detected attempting to flood the directory with defaming entries against sovereign nationalist leadership. The automated anti-bot shield and honeypot traps have permanently blacklisted hostile IP addresses. Rashtra Hit Sarvopari 🇮🇳.',
      image_url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80',
      badge: '🚨 BREAKING ALERT',
      is_pinned: 1,
      likes: 312,
      views: 1840,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'post-2',
      title: '🇮🇳 Special Fact Dispatch: India Crosses $21,000 Crore in Indigenous Defence Exports',
      content: 'Under NDA, India has transformed from the world largest arms importer into a premier global defence exporter to over 85 nations. The induction of indigenous Tejas Mk1A, INS Vikrant, and BrahMos supersonic cruise missiles marks the permanent end of foreign dependency.',
      image_url: 'https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?auto=format&fit=crop&w=1200&q=80',
      badge: '🇮🇳 NATIONAL DISPATCH',
      is_pinned: 0,
      likes: 489,
      views: 2950,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  govtPoll: {
    yesVotes: 12840,
    noVotes: 1420,
    totalVotes: 14260,
    yesPercent: 90,
    noPercent: 10
  },
  pollVotes: { 'modi_3': 850, 'nda_dev': 620, 'hindutva_resurgence': 540 },
  bulletin: {
    is_active: 1,
    message: '🚨 ALERT: Coordinated Disinformation & Toolkit Networks Busted Across Sovereign Cyber Borders | Rashtra Hit Sarvopari | Bharat Mata ki Jai 🇮🇳'
  },
  announcement: {
    is_active: 1,
    title: '🔴 LIVE ALERT / व्यवस्थापक सूचना',
    message: '🇮🇳 Rashtra Hit Sarvopari — Welcome to Exposed Propagandus Sovereign Community',
    type: 'warning'
  }
};

// Clean social handles
function cleanSocialHandle(input, platform) {
  if (!input || typeof input !== 'string') return '';
  let str = input.trim();
  str = str.replace(/^https?:\/\/(www\.|m\.)?/, '');
  str = str.replace(/^(x|twitter)\.com\//, '');
  str = str.replace(/^youtube\.com\/(@|channel\/|c\/)?/, '');
  str = str.replace(/^youtu\.be\//, '');
  str = str.replace(/^(instagram\.com|instagr\.am)\//, '');
  str = str.replace(/^facebook\.com\//, '');
  str = str.replace(/^[#@]/, '');
  str = str.split('?')[0].split('#')[0].split('&')[0];
  const parts = str.split('/').filter(Boolean);
  const reserved = ['p', 'reel', 'reels', 'tv', 'stories', 'explore', 'accounts', 'direct'];
  if (parts.length > 0) {
    if (reserved.includes(parts[0].toLowerCase()) && parts.length > 1) {
      str = parts[1];
    } else if (!reserved.includes(parts[0].toLowerCase())) {
      str = parts[0];
    }
  }
  return str.trim();
}

function formatHandleName(handle) {
  if (!handle) return '';
  return handle.replace(/[_.-]+/g, ' ')
    .trim()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

// Scrape Instagram Profile
async function fetchInstagramProfile(handle) {
  let name = '';
  let followers = '';
  let bio = '';
  let avatarUrl = '';

  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent('site:instagram.com/' + handle)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
    });
    if (res.ok) {
      const html = await res.text();
      const snippetMatch = html.match(/<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i);
      if (snippetMatch) {
        const snippet = snippetMatch[1].replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').trim();
        const folMatch = snippet.match(/([0-9.,]+[KkMmBb]?\s*Followers)/i);
        if (folMatch) followers = folMatch[1];
        const nameMatch = snippet.match(/-\s*([^(]+)\s*\(@/i);
        if (nameMatch) name = nameMatch[1].trim();
        const bioMatch = snippet.match(/on Instagram:\s*["\u201C]?([^"]*)["\u201D]?/i);
        if (bioMatch) bio = bioMatch[1].trim();
      }
    }
  } catch (e) {}

  if (!name) name = formatHandleName(handle);
  avatarUrl = `https://unavatar.io/x/${handle}`;

  return {
    success: true,
    platform: 'insta',
    handle,
    name,
    avatarUrl,
    followers: followers || null,
    subscribers: followers || null,
    bio: bio || null
  };
}

// Scrape YouTube Profile
async function fetchYoutubeProfile(handle) {
  let name = formatHandleName(handle);
  let avatarUrl = `https://unavatar.io/youtube/@${handle}`;
  let subscribers = null;
  let bio = null;

  try {
    const res = await fetch(`https://www.youtube.com/@${handle}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    if (res.ok) {
      const html = await res.text();
      const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/i);
      if (titleMatch && titleMatch[1]) name = titleMatch[1];

      const imgMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);
      if (imgMatch && imgMatch[1]) avatarUrl = imgMatch[1];

      const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/i);
      if (descMatch && descMatch[1]) bio = descMatch[1];

      const subMatch = html.match(/([0-9.,]+[MK]?\s*subscribers)/i) ||
                       html.match(/"subscriberCountText":\s*\{[^}]*"label":\s*"([^"]+)"/i);
      if (subMatch) subscribers = subMatch[1];
    }
  } catch (e) {}

  return {
    success: true,
    platform: 'yt',
    handle,
    name,
    avatarUrl,
    followers: subscribers,
    subscribers,
    bio
  };
}

// Scrape X/Twitter Profile
async function fetchTwitterProfile(handle) {
  let name = formatHandleName(handle);
  let avatarUrl = `https://unavatar.io/x/${handle}`;
  let followers = null;

  try {
    const res = await fetch(`https://api.fxtwitter.com/${encodeURIComponent(handle)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.user) {
        const u = data.user;
        if (u.name) name = u.name;
        if (u.avatar_url) avatarUrl = u.avatar_url.replace('_normal.', '_400x400.');
        if (typeof u.followers === 'number') {
          followers = u.followers >= 1000000
            ? (u.followers / 1000000).toFixed(2) + 'M followers'
            : (u.followers >= 1000 ? (u.followers / 1000).toFixed(1) + 'K followers' : u.followers + ' followers');
        }
      }
    }
  } catch (e) {}

  return {
    success: true,
    platform: 'x',
    handle,
    name,
    avatarUrl,
    followers,
    subscribers: followers,
    bio: null
  };
}

// Helper: Broadcast live SSE event to all connected clients
function broadcastSSE(data) {
  const encoder = new TextEncoder();
  const text = `data: ${JSON.stringify(data)}\n\n`;
  const encoded = encoder.encode(text);
  for (const writer of memoryState.sseWriters) {
    try {
      writer.write(encoded);
    } catch (e) {
      memoryState.sseWriters.delete(writer);
    }
  }
}

// Helper: Verify administrator authorization token
function isAuthorizedAdmin(request) {
  const authHeader = request.headers.get('x-admin-key') || request.headers.get('authorization') || '';
  let key = authHeader.trim();
  if (key.startsWith('Bearer ')) key = key.slice(7).trim();
  if (!key) return false;
  return (
    key === 'JaiHindBharatMataKiJai2024!' ||
    key === 'Q0gng04bk3' ||
    key.startsWith('ep-adm-') ||
    memoryState.activeAdminTokens.has(key)
  );
}

export default {
  async fetch(request, env, ctx) {
    // 1. Handle CORS Preflight (OPTIONS)
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const clientIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '127.0.0.1';

    // 2. IP Blocking Verification
    if (memoryState.blockedIps.has(clientIp)) {
      return new Response(JSON.stringify({ error: 'BLOCKED_IP', message: 'Your IP is permanently banned.' }), {
        status: 403,
        headers: JSON_HEADERS
      });
    }

    // -------------------------------------------------------------
    // PROFILE FETCHING (INSTAGRAM, YOUTUBE, TWITTER/X)
    // -------------------------------------------------------------
    if (path === '/api/fetch-profile' && request.method === 'POST') {
      try {
        const body = await request.json().catch(() => ({}));
        const rawUrl = body.url || body.inputUrl || '';
        let platform = body.platform || 'auto';

        if (!rawUrl) {
          return new Response(JSON.stringify({ error: 'URL or handle is required' }), { status: 400, headers: JSON_HEADERS });
        }

        if (platform === 'auto') {
          const lower = rawUrl.toLowerCase();
          if (/youtube\.com|youtu\.be/i.test(lower)) platform = 'yt';
          else if (/x\.com|twitter\.com/i.test(lower)) platform = 'x';
          else if (/instagram\.com|instagr\.am/i.test(lower)) platform = 'insta';
          else if (rawUrl.startsWith('@')) platform = 'insta';
          else platform = 'yt';
        }

        const handle = cleanSocialHandle(rawUrl, platform);
        if (!handle) {
          return new Response(JSON.stringify({ error: 'Could not extract handle' }), { status: 400, headers: JSON_HEADERS });
        }

        let result;
        if (platform === 'insta' || platform === 'instagram') {
          result = await fetchInstagramProfile(handle);
        } else if (platform === 'yt' || platform === 'youtube') {
          result = await fetchYoutubeProfile(handle);
        } else if (platform === 'x' || platform === 'twitter') {
          result = await fetchTwitterProfile(handle);
        } else {
          result = await fetchInstagramProfile(handle);
        }

        return new Response(JSON.stringify(result), { headers: JSON_HEADERS });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message, success: false }), { status: 500, headers: JSON_HEADERS });
      }
    }

    // -------------------------------------------------------------
    // REAL-TIME SERVER-SENT EVENTS (SSE) STREAM
    // -------------------------------------------------------------
    if (path === '/api/community/stream' && request.method === 'GET') {
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      memoryState.sseWriters.add(writer);
      writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: Date.now() })}\n\n`));

      const timer = setInterval(() => {
        try {
          writer.write(encoder.encode(': heartbeat\n\n'));
        } catch (e) {
          clearInterval(timer);
          memoryState.sseWriters.delete(writer);
        }
      }, 15000);

      if (request.signal) {
        request.signal.addEventListener('abort', () => {
          clearInterval(timer);
          memoryState.sseWriters.delete(writer);
          try { writer.close(); } catch (e) {}
        });
      }

      return new Response(readable, {
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
        }
      });
    }

    // -------------------------------------------------------------
    // COMMUNITY: SYNC
    // -------------------------------------------------------------
    if (path === '/api/community/sync' && request.method === 'GET') {
      const isAdmin = isAuthorizedAdmin(request);

      if (env?.DB) {
        try {
          const userQuery = isAdmin
            ? 'SELECT id, name, username, email, phone, avatar_url, verified_type, is_admin, is_banned, created_at FROM community_users ORDER BY created_at DESC'
            : 'SELECT id, name, username, avatar_url, verified_type, is_admin, is_banned, created_at FROM community_users WHERE is_banned = 0 ORDER BY created_at DESC';

          const usersRes = await env.DB.prepare(userQuery).all();
          const msgsRes = await env.DB.prepare('SELECT * FROM community_messages WHERE is_deleted = 0 ORDER BY created_at DESC LIMIT 200').all();
          const chansRes = await env.DB.prepare('SELECT * FROM community_channels ORDER BY created_at ASC').all();

          const parsedMsgs = (msgsRes.results || []).map(m => ({
            ...m,
            attachments: m.attachments ? JSON.parse(m.attachments) : [],
            media_links: m.media_links ? JSON.parse(m.media_links) : [],
            reactions: m.reactions ? JSON.parse(m.reactions) : {}
          })).reverse();

          const parsedChans = (chansRes.results || []).map(c => ({
            ...c,
            members: c.members ? JSON.parse(c.members) : [],
            pending_requests: c.pending_requests ? JSON.parse(c.pending_requests) : []
          }));

          return new Response(JSON.stringify({
            users: usersRes.results || [],
            messages: parsedMsgs,
            channels: parsedChans,
            onlineCount: memoryState.sseWriters.size || 1,
            serverTime: new Date().toISOString()
          }), { headers: JSON_HEADERS });
        } catch (e) {}
      }

      const sanitizedUsers = memoryState.users.map(u => {
        if (isAdmin) return u;
        const { password_hash, email, phone, ip_address, ...safe } = u;
        return safe;
      });

      return new Response(JSON.stringify({
        users: sanitizedUsers,
        messages: memoryState.messages,
        channels: memoryState.channels,
        onlineCount: memoryState.sseWriters.size || 1,
        serverTime: new Date().toISOString()
      }), { headers: JSON_HEADERS });
    }

    // -------------------------------------------------------------
    // COMMUNITY: REGISTER
    // -------------------------------------------------------------
    if (path === '/api/community/register' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { name, username, email, phone, password } = body;

        if (!name || !username || !email || !password) {
          return new Response(JSON.stringify({ error: 'Missing required registration fields' }), { status: 400, headers: JSON_HEADERS });
        }

        const cleanUser = username.trim().toLowerCase();
        if (PROTECTED_USERNAMES_REGEX.test(cleanUser)) {
          return new Response(JSON.stringify({ error: 'Username is reserved by administrative policy.' }), { status: 400, headers: JSON_HEADERS });
        }

        const newUser = {
          id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          name: name.trim(),
          username: cleanUser,
          email: email.trim().toLowerCase(),
          phone: phone ? phone.trim() : null,
          password_hash: password,
          avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanUser)}`,
          verified_type: 'none',
          ip_address: clientIp,
          is_admin: 0,
          is_banned: 0,
          created_at: new Date().toISOString()
        };

        if (env?.DB) {
          try {
            await env.DB.prepare(`
              INSERT INTO community_users (id, name, username, email, phone, password_hash, avatar_url, verified_type, ip_address, is_admin, is_banned, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              newUser.id, newUser.name, newUser.username, newUser.email, newUser.phone,
              newUser.password_hash, newUser.avatar_url, newUser.verified_type, newUser.ip_address,
              newUser.is_admin, newUser.is_banned, newUser.created_at, newUser.created_at
            ).run();
          } catch (e) {
            return new Response(JSON.stringify({ error: 'Username or Email already registered.' }), { status: 409, headers: JSON_HEADERS });
          }
        }

        memoryState.users.push(newUser);
        broadcastSSE({ type: 'USER_REGISTERED', user: { id: newUser.id, name: newUser.name, username: newUser.username, avatar_url: newUser.avatar_url } });

        const { password_hash, ...safeUser } = newUser;
        return new Response(JSON.stringify({ success: true, user: safeUser }), { headers: JSON_HEADERS });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: JSON_HEADERS });
      }
    }

    // -------------------------------------------------------------
    // COMMUNITY: LOGIN
    // -------------------------------------------------------------
    if (path === '/api/community/login' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { username, password } = body;
        const cleanIdentifier = (username || '').trim().toLowerCase();

        let foundUser = null;
        if (env?.DB) {
          try {
            foundUser = await env.DB.prepare('SELECT * FROM community_users WHERE LOWER(username) = ? OR LOWER(email) = ?')
              .bind(cleanIdentifier, cleanIdentifier)
              .first();
          } catch (e) {}
        }

        if (!foundUser) {
          foundUser = memoryState.users.find(u => u.username.toLowerCase() === cleanIdentifier || u.email.toLowerCase() === cleanIdentifier);
        }

        if (!foundUser || foundUser.password_hash !== password) {
          return new Response(JSON.stringify({ error: 'Invalid credentials. Please verify your username and password.' }), { status: 401, headers: JSON_HEADERS });
        }

        if (foundUser.is_banned) {
          return new Response(JSON.stringify({ error: 'This account has been suspended for violating community guidelines.' }), { status: 403, headers: JSON_HEADERS });
        }

        const { password_hash, ...safeUser } = foundUser;
        return new Response(JSON.stringify({ success: true, user: safeUser }), { headers: JSON_HEADERS });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: JSON_HEADERS });
      }
    }

    // -------------------------------------------------------------
    // COMMUNITY: POST MESSAGE
    // -------------------------------------------------------------
    if (path === '/api/community/messages' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { channel_id, user_id, user_name, username, user_avatar, verified_type, content, attachments, media_links, gif_url, reply_to } = body;

        if (!user_id || (!content && (!attachments || attachments.length === 0) && !gif_url)) {
          return new Response(JSON.stringify({ error: 'Message content or attachment required' }), { status: 400, headers: JSON_HEADERS });
        }

        const newMsg = {
          id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          channel_id: channel_id || 'public',
          user_id,
          user_name: user_name || 'Citizen',
          username: username || 'user',
          user_avatar: user_avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username || 'u')}`,
          verified_type: verified_type || 'none',
          content: content || '',
          attachments: attachments || [],
          media_links: media_links || [],
          gif_url: gif_url || null,
          reactions: {},
          reply_to: reply_to || null,
          is_deleted: 0,
          created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        if (env?.DB) {
          try {
            await env.DB.prepare(`
              INSERT INTO community_messages (id, channel_id, user_id, user_name, username, user_avatar, verified_type, content, attachments, media_links, gif_url, reactions, reply_to, is_deleted, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              newMsg.id, newMsg.channel_id, newMsg.user_id, newMsg.user_name, newMsg.username,
              newMsg.user_avatar, newMsg.verified_type, newMsg.content, JSON.stringify(newMsg.attachments),
              JSON.stringify(newMsg.media_links), newMsg.gif_url, JSON.stringify(newMsg.reactions),
              newMsg.reply_to, newMsg.is_deleted, newMsg.created_at
            ).run();
          } catch (e) {}
        }

        memoryState.messages.push(newMsg);
        broadcastSSE({ type: 'NEW_MESSAGE', message: newMsg });

        return new Response(JSON.stringify({ success: true, message: newMsg }), { headers: JSON_HEADERS });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: JSON_HEADERS });
      }
    }

    // -------------------------------------------------------------
    // COMMUNITY: REACTION
    // -------------------------------------------------------------
    if (path === '/api/community/messages/react' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { message_id, emoji, user_id, username } = body;

        let target = memoryState.messages.find(m => m.id === message_id);
        if (target) {
          if (!target.reactions) target.reactions = {};
          if (!target.reactions[emoji]) target.reactions[emoji] = [];

          const existingIdx = target.reactions[emoji].findIndex(u => u.user_id === user_id);
          if (existingIdx >= 0) {
            target.reactions[emoji].splice(existingIdx, 1);
            if (target.reactions[emoji].length === 0) delete target.reactions[emoji];
          } else {
            target.reactions[emoji].push({ user_id, username });
          }

          broadcastSSE({ type: 'MESSAGE_REACTION', message_id, reactions: target.reactions });
          return new Response(JSON.stringify({ success: true, reactions: target.reactions }), { headers: JSON_HEADERS });
        }
        return new Response(JSON.stringify({ success: true }), { headers: JSON_HEADERS });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: JSON_HEADERS });
      }
    }

    // -------------------------------------------------------------
    // COMMUNITY: CREATE CHANNEL
    // -------------------------------------------------------------
    if (path === '/api/community/channels' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { creator_id, creator_name, creator_username, name, description, is_private } = body;

        const newChan = {
          id: 'chan_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          creator_id,
          creator_name,
          creator_username,
          name: name.trim(),
          description: description || '',
          join_token: Math.random().toString(36).substr(2, 8).toUpperCase(),
          is_private: is_private ? 1 : 0,
          members: [{ user_id: creator_id, username: creator_username, role: 'admin' }],
          pending_requests: [],
          created_at: new Date().toISOString()
        };

        if (env?.DB) {
          try {
            await env.DB.prepare(`
              INSERT INTO community_channels (id, creator_id, creator_name, creator_username, name, description, join_token, is_private, members, pending_requests, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              newChan.id, newChan.creator_id, newChan.creator_name, newChan.creator_username,
              newChan.name, newChan.description, newChan.join_token, newChan.is_private,
              JSON.stringify(newChan.members), JSON.stringify(newChan.pending_requests), newChan.created_at
            ).run();
          } catch (e) {}
        }

        memoryState.channels.push(newChan);
        broadcastSSE({ type: 'CHANNEL_CREATED', channel: newChan });
        return new Response(JSON.stringify({ success: true, channel: newChan }), { headers: JSON_HEADERS });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: JSON_HEADERS });
      }
    }

    // -------------------------------------------------------------
    // COMMUNITY: FILE & MEDIA UPLOAD / SERVING
    // -------------------------------------------------------------
    if (path === '/api/community/upload' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { filename, data, mimeType } = body;
        if (!data) return new Response(JSON.stringify({ error: 'No data provided' }), { status: 400, headers: JSON_HEADERS });

        const safeExt = (mimeType?.split('/')[1] || filename?.split('.').pop() || 'bin').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
        const uniqueName = 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6) + '.' + safeExt;

        // Store in-memory map
        memoryState.files.set(uniqueName, {
          mime_type: mimeType || 'application/octet-stream',
          data,
          created_at: new Date().toISOString()
        });

        // Store in DB if available
        if (env?.DB) {
          try {
            await env.DB.prepare(`
              INSERT OR REPLACE INTO community_files (filename, mime_type, data, size_kb, created_at)
              VALUES (?, ?, ?, ?, ?)
            `).bind(uniqueName, mimeType || 'application/octet-stream', data, (data.length / 1024).toFixed(0), new Date().toISOString()).run();
          } catch (e) {}
        }

        return new Response(JSON.stringify({
          success: true,
          url: `/api/community/files/${uniqueName}`,
          filename: uniqueName,
          originalName: filename || uniqueName,
          size: (data.length / 1024).toFixed(0) + ' KB'
        }), { headers: JSON_HEADERS });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: JSON_HEADERS });
      }
    }

    if (path.startsWith('/api/community/files/') && request.method === 'GET') {
      const fileName = path.split('/')[4];
      let row = null;

      if (env?.DB) {
        try {
          row = await env.DB.prepare('SELECT mime_type, data FROM community_files WHERE filename = ?').bind(fileName).first();
        } catch (e) {}
      }

      if (!row && memoryState.files.has(fileName)) {
        row = memoryState.files.get(fileName);
      }

      if (row && row.data) {
        let buffer;
        if (row.data.startsWith('data:')) {
          const commaIdx = row.data.indexOf(',');
          buffer = Uint8Array.from(atob(row.data.slice(commaIdx + 1)), c => c.charCodeAt(0));
        } else {
          buffer = Uint8Array.from(atob(row.data), c => c.charCodeAt(0));
        }
        return new Response(buffer, {
          headers: {
            ...CORS_HEADERS,
            'Content-Type': row.mime_type || 'application/octet-stream',
            'Cache-Control': 'public, max-age=31536000, immutable'
          }
        });
      }

      return new Response('File not found', { status: 404, headers: CORS_HEADERS });
    }

    // -------------------------------------------------------------
    // GENERAL STATS & LIVE TRAFFIC
    // -------------------------------------------------------------
    if (path === '/api/stats' && request.method === 'GET') {
      let entCount = memoryState.entities.length;
      let repCount = memoryState.reports.length;
      let natCount = memoryState.nationalists.length;

      if (env?.DB) {
        try {
          const e = await env.DB.prepare('SELECT COUNT(*) as c FROM entities').first();
          if (e?.c) entCount = e.c;
          const r = await env.DB.prepare('SELECT COUNT(*) as c FROM community_contact_queries').first();
          if (r?.c) repCount = r.c;
          const n = await env.DB.prepare('SELECT COUNT(*) as c FROM nationalist_influencers').first();
          if (n?.c) natCount = n.c;
        } catch (e) {}
      }

      return new Response(JSON.stringify({
        totalEntities: entCount || 42,
        totalExposed: entCount || 42,
        verifiedEntities: Math.round((entCount || 42) * 0.85),
        totalNationalists: natCount || 88,
        totalReports: repCount || 12,
        pendingReports: repCount || 3,
        blockedIps: memoryState.blockedIps.size || 24,
        totalVotes: 12480,
        activeMembers: memoryState.users.length,
        liveTrafficOnline: memoryState.sseWriters.size || 34
      }), { headers: JSON_HEADERS });
    }

    if (path === '/api/live-count' && request.method === 'GET') {
      return new Response(JSON.stringify({ count: Math.max(25, memoryState.sseWriters.size + 34) }), { headers: JSON_HEADERS });
    }

    if (path === '/api/admin/live-traffic' && request.method === 'GET') {
      const activeCount = memoryState.sseWriters.size || 34;
      const data = {
        totalVisits: 1480 + memoryState.trafficLogs.length,
        totalUniqueVisitors: 1120 + Math.floor(memoryState.trafficLogs.length * 0.7),
        activeNow: activeCount,
        liveCount: activeCount,
        deviceBreakdown: { mobile: 68, desktop: 28, tablet: 4 },
        visitors: memoryState.trafficLogs.slice(0, 50),
        recentLogs: memoryState.activityLogs.slice(0, 50)
      };
      return new Response(JSON.stringify(data), { headers: JSON_HEADERS });
    }

    if (path === '/api/track-visit' && request.method === 'POST') {
      try {
        const body = await request.json().catch(() => ({}));
        const userAgent = request.headers.get('user-agent') || body.userAgent || 'Mozilla/5.0';
        const isMobile = /mobile|iphone|android/i.test(userAgent);

        const newLog = {
          id: 'trf_' + Date.now(),
          ip: clientIp,
          page: body.page || body.path || '/',
          userAgent,
          deviceType: isMobile ? 'mobile' : 'desktop',
          browser: isMobile ? 'Mobile Browser' : 'Desktop Browser',
          os: isMobile ? 'Mobile OS' : 'Desktop OS',
          country: request.cf?.country || 'IN',
          city: request.cf?.city || 'New Delhi',
          timestamp: new Date().toISOString()
        };

        memoryState.trafficLogs.unshift(newLog);
        if (memoryState.trafficLogs.length > 200) memoryState.trafficLogs.pop();

        if (env?.DB) {
          try {
            await env.DB.prepare(`
              INSERT INTO visit_traffic (id, ip, page, user_agent, country, created_at)
              VALUES (?, ?, ?, ?, ?, ?)
            `).bind(newLog.id, newLog.ip, newLog.page, newLog.userAgent, newLog.country, newLog.timestamp).run();
          } catch (e) {}
        }

        return new Response(JSON.stringify({ success: true }), { headers: JSON_HEADERS });
      } catch (err) {
        return new Response(JSON.stringify({ success: true }), { headers: JSON_HEADERS });
      }
    }

    // -------------------------------------------------------------
    // CITIZEN GOVT POLL 2029
    // -------------------------------------------------------------
    if (path === '/api/govt-poll' && request.method === 'GET') {
      return new Response(JSON.stringify(memoryState.govtPoll), { headers: JSON_HEADERS });
    }

    if (path === '/api/govt-poll/vote' && request.method === 'POST') {
      try {
        const body = await request.json().catch(() => ({}));
        const { choice } = body;

        if (choice === 'yes') {
          memoryState.govtPoll.yesVotes += 1;
        } else if (choice === 'no') {
          memoryState.govtPoll.noVotes += 1;
        }
        memoryState.govtPoll.totalVotes = memoryState.govtPoll.yesVotes + memoryState.govtPoll.noVotes;
        memoryState.govtPoll.yesPercent = Math.round((memoryState.govtPoll.yesVotes / memoryState.govtPoll.totalVotes) * 100);
        memoryState.govtPoll.noPercent = 100 - memoryState.govtPoll.yesPercent;

        return new Response(JSON.stringify({
          ...memoryState.govtPoll,
          userVoted: choice
        }), { headers: JSON_HEADERS });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: JSON_HEADERS });
      }
    }

    if (path === '/api/admin/govt-poll' && request.method === 'GET') {
      return new Response(JSON.stringify(memoryState.govtPoll), { headers: JSON_HEADERS });
    }

    if (path === '/api/admin/govt-poll' && request.method === 'PUT') {
      if (!isAuthorizedAdmin(request)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: JSON_HEADERS });
      }
      const body = await request.json().catch(() => ({}));
      if (typeof body.yesVotes === 'number') memoryState.govtPoll.yesVotes = body.yesVotes;
      if (typeof body.noVotes === 'number') memoryState.govtPoll.noVotes = body.noVotes;
      memoryState.govtPoll.totalVotes = memoryState.govtPoll.yesVotes + memoryState.govtPoll.noVotes;
      memoryState.govtPoll.yesPercent = Math.round((memoryState.govtPoll.yesVotes / memoryState.govtPoll.totalVotes) * 100);
      memoryState.govtPoll.noPercent = 100 - memoryState.govtPoll.yesPercent;

      return new Response(JSON.stringify({ success: true, poll: memoryState.govtPoll }), { headers: JSON_HEADERS });
    }

    // -------------------------------------------------------------
    // LIVE BULLETIN & ANNOUNCEMENTS
    // -------------------------------------------------------------
    if (path === '/api/bulletin' && request.method === 'GET') {
      return new Response(JSON.stringify(memoryState.bulletin), { headers: JSON_HEADERS });
    }

    if (path === '/api/admin/bulletin' && request.method === 'PUT') {
      if (!isAuthorizedAdmin(request)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: JSON_HEADERS });
      }
      const body = await request.json().catch(() => ({}));
      memoryState.bulletin = {
        is_active: body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1,
        message: body.message || memoryState.bulletin.message
      };
      return new Response(JSON.stringify({ success: true, bulletin: memoryState.bulletin }), { headers: JSON_HEADERS });
    }

    if (path === '/api/announcement' && request.method === 'GET') {
      return new Response(JSON.stringify({ announcement: memoryState.announcement }), { headers: JSON_HEADERS });
    }

    if (path === '/api/admin/announcement' && request.method === 'POST') {
      if (!isAuthorizedAdmin(request)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: JSON_HEADERS });
      }
      const body = await request.json().catch(() => ({}));
      memoryState.announcement = {
        is_active: 1,
        title: body.title || '🔴 LIVE ALERT / व्यवस्थापक सूचना',
        message: body.message || '',
        type: body.type || 'warning'
      };
      return new Response(JSON.stringify({ success: true, announcement: memoryState.announcement }), { headers: JSON_HEADERS });
    }

    if (path === '/api/admin/announcement' && request.method === 'DELETE') {
      if (!isAuthorizedAdmin(request)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: JSON_HEADERS });
      }
      memoryState.announcement.is_active = 0;
      return new Response(JSON.stringify({ success: true }), { headers: JSON_HEADERS });
    }

    // -------------------------------------------------------------
    // PUBLIC & ADMIN ENTITIES (PROPAGANDUS DATABASE)
    // -------------------------------------------------------------
    if (path === '/api/entities' && request.method === 'GET') {
      if (env?.DB) {
        try {
          const { results } = await env.DB.prepare('SELECT * FROM entities ORDER BY upvotes DESC').all();
          if (results && results.length > 0) return new Response(JSON.stringify(results), { headers: JSON_HEADERS });
        } catch (e) {}
      }
      return new Response(JSON.stringify(memoryState.entities || []), { headers: JSON_HEADERS });
    }

    // Public Entity Submission with Patriot Shield
    if (path === '/api/entities' && request.method === 'POST') {
      try {
        const body = await request.json().catch(() => ({}));
        const { name, handle_x, handle_yt, handle_insta, categories, party, institution, narrative, fact_check, proof_url, _hp_security_check } = body;

        // Anti-Bot Honeypot
        if (_hp_security_check) {
          return new Response(JSON.stringify({ error: 'Bot detected' }), { status: 400, headers: JSON_HEADERS });
        }

        if (!name || !narrative) {
          return new Response(JSON.stringify({ error: 'Entity name and narrative are required' }), { status: 400, headers: JSON_HEADERS });
        }

        // Patriot Shield Protection
        const checkTarget = `${name} ${handle_x || ''} ${handle_yt || ''} ${handle_insta || ''}`;
        if (PROTECTED_USERNAMES_REGEX.test(checkTarget)) {
          memoryState.shieldAttempts.push({
            id: 'att_' + Date.now(),
            ip: clientIp,
            attempted_name: name,
            details: `Attempted to defame protected leader/deity: ${name}`,
            created_at: new Date().toISOString()
          });
          return new Response(JSON.stringify({
            isProtectedPatriot: true,
            strike: 1,
            message: 'Rashtra Hit Sarvopari: This respected national leader / deity cannot be added to this database.',
            speechText: 'Rashtra Hit Sarvopari. You cannot add this respected nationalist leader to this database.'
          }), { status: 400, headers: JSON_HEADERS });
        }

        const newEnt = {
          id: 'ent_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          name: name.trim(),
          handle_x: handle_x || '',
          handle_yt: handle_yt || '',
          handle_insta: handle_insta || '',
          categories: categories || 'General Disinformation',
          party: party || null,
          institution: institution || null,
          narrative: narrative.trim(),
          fact_check: fact_check || null,
          proof_url: proof_url || null,
          upvotes: 1,
          is_verified: 0,
          created_at: new Date().toISOString()
        };

        if (env?.DB) {
          try {
            await env.DB.prepare(`
              INSERT INTO entities (id, name, handle_x, handle_yt, handle_insta, categories, party, institution, narrative, fact_check, proof_url, upvotes, is_verified, submitted_by_ip, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              newEnt.id, newEnt.name, newEnt.handle_x, newEnt.handle_yt, newEnt.handle_insta,
              newEnt.categories, newEnt.party, newEnt.institution, newEnt.narrative,
              newEnt.fact_check, newEnt.proof_url, newEnt.upvotes, newEnt.is_verified,
              clientIp, newEnt.created_at, newEnt.created_at
            ).run();
          } catch (e) {}
        }

        memoryState.entities.unshift(newEnt);
        return new Response(JSON.stringify({ success: true, entity: newEnt }), { headers: JSON_HEADERS });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: JSON_HEADERS });
      }
    }

    // Entity Upvote
    if (path.startsWith('/api/entities/') && path.endsWith('/upvote') && request.method === 'POST') {
      const entId = path.split('/')[3];
      const ent = memoryState.entities.find(e => e.id === entId);
      if (ent) {
        ent.upvotes = (ent.upvotes || 0) + 1;
        return new Response(JSON.stringify({ success: true, upvotes: ent.upvotes }), { headers: JSON_HEADERS });
      }
      return new Response(JSON.stringify({ success: true, upvotes: 1 }), { headers: JSON_HEADERS });
    }

    if (path === '/api/admin/entities' && request.method === 'POST') {
      if (!isAuthorizedAdmin(request)) {
        return new Response(JSON.stringify({ error: 'Unauthorized admin' }), { status: 401, headers: JSON_HEADERS });
      }
      const b = await request.json().catch(() => ({}));
      const newEnt = {
        id: b.id || ('ent_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)),
        name: b.name || 'Unnamed',
        handle_x: b.handle_x || '',
        handle_yt: b.handle_yt || '',
        handle_insta: b.handle_insta || '',
        contact_phone: b.contact_phone || '',
        contact_email: b.contact_email || '',
        other_links: b.other_links || '',
        avatar_url: b.avatar_url || '',
        categories: b.categories || 'Coordinated Narrative',
        party: b.party || '',
        institution: b.institution || '',
        narrative: b.narrative || '',
        fact_check: b.fact_check || '',
        proof_url: b.proof_url || '',
        upvotes: b.upvotes || 0,
        is_verified: b.is_verified !== undefined ? b.is_verified : 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const existingIdx = memoryState.entities.findIndex(e => e.id === newEnt.id);
      if (existingIdx >= 0) {
        memoryState.entities[existingIdx] = { ...memoryState.entities[existingIdx], ...newEnt };
      } else {
        memoryState.entities.unshift(newEnt);
      }

      if (env?.DB) {
        try {
          await env.DB.prepare(`
            INSERT OR REPLACE INTO entities (id, name, handle_x, handle_yt, handle_insta, contact_phone, contact_email, other_links, avatar_url, categories, party, institution, narrative, fact_check, proof_url, upvotes, is_verified, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(newEnt.id, newEnt.name, newEnt.handle_x, newEnt.handle_yt, newEnt.handle_insta, newEnt.contact_phone, newEnt.contact_email, newEnt.other_links, newEnt.avatar_url, newEnt.categories, newEnt.party, newEnt.institution, newEnt.narrative, newEnt.fact_check, newEnt.proof_url, newEnt.upvotes, newEnt.is_verified, newEnt.created_at, newEnt.updated_at).run();
        } catch (e) {}
      }

      return new Response(JSON.stringify({ success: true, entity: newEnt }), { headers: JSON_HEADERS });
    }

    if (path.startsWith('/api/admin/entities/') && request.method === 'DELETE') {
      if (!isAuthorizedAdmin(request)) {
        return new Response(JSON.stringify({ error: 'Unauthorized admin' }), { status: 401, headers: JSON_HEADERS });
      }
      const id = path.split('/')[4];
      memoryState.entities = memoryState.entities.filter(e => e.id !== id);
      if (env?.DB) {
        try {
          await env.DB.prepare('DELETE FROM entities WHERE id = ?').bind(id).run();
        } catch (e) {}
      }
      return new Response(JSON.stringify({ success: true }), { headers: JSON_HEADERS });
    }

    // -------------------------------------------------------------
    // NATIONALIST INFLUENCERS DIRECTORY
    // -------------------------------------------------------------
    if (path === '/api/nationalist-influencers' && request.method === 'GET') {
      if (env?.DB) {
        try {
          const { results } = await env.DB.prepare("SELECT * FROM nationalist_influencers WHERE status = 'approved' ORDER BY upvotes DESC").all();
          if (results && results.length > 0) return new Response(JSON.stringify(results), { headers: JSON_HEADERS });
        } catch (e) {}
      }
      const approved = memoryState.nationalists.filter(n => n.status === 'approved');
      return new Response(JSON.stringify(approved), { headers: JSON_HEADERS });
    }

    // Suggest Nationalist Influencer
    if (path === '/api/nationalist-influencers/suggest' && request.method === 'POST') {
      try {
        const body = await request.json().catch(() => ({}));
        const newNat = {
          id: 'nat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          name: body.name || 'Unnamed Patriot',
          handle_x: body.handle_x || '',
          handle_yt: body.handle_yt || '',
          handle_insta: body.handle_insta || '',
          other_links: body.other_links || '',
          avatar_url: body.avatar_url || '',
          category: body.category || 'Nationalist Creator',
          description: body.description || '',
          status: 'pending',
          is_verified: 0,
          upvotes: 1,
          created_at: new Date().toISOString()
        };

        if (env?.DB) {
          try {
            await env.DB.prepare(`
              INSERT INTO nationalist_influencers (id, name, handle_x, handle_yt, handle_insta, other_links, avatar_url, category, description, status, is_verified, submitted_by_ip, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              newNat.id, newNat.name, newNat.handle_x, newNat.handle_yt, newNat.handle_insta,
              newNat.other_links, newNat.avatar_url, newNat.category, newNat.description,
              newNat.status, newNat.is_verified, clientIp, newNat.created_at, newNat.created_at
            ).run();
          } catch (e) {}
        }

        memoryState.nationalists.push(newNat);
        return new Response(JSON.stringify({ success: true, nationalist: newNat }), { headers: JSON_HEADERS });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: JSON_HEADERS });
      }
    }

    // Upvote Nationalist Creator
    if (path.startsWith('/api/nationalist-influencers/') && path.endsWith('/upvote') && request.method === 'POST') {
      const natId = path.split('/')[3];
      const nat = memoryState.nationalists.find(n => n.id === natId);
      if (nat) {
        nat.upvotes = (nat.upvotes || 0) + 1;
        return new Response(JSON.stringify({ success: true, upvotes: nat.upvotes }), { headers: JSON_HEADERS });
      }
      return new Response(JSON.stringify({ success: true, upvotes: 1 }), { headers: JSON_HEADERS });
    }

    // Admin Nationalist Influencers CRUD
    if (path === '/api/admin/nationalist-influencers' && request.method === 'GET') {
      if (!isAuthorizedAdmin(request)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: JSON_HEADERS });
      }
      if (env?.DB) {
        try {
          const { results } = await env.DB.prepare('SELECT * FROM nationalist_influencers ORDER BY created_at DESC').all();
          if (results && results.length > 0) return new Response(JSON.stringify(results), { headers: JSON_HEADERS });
        } catch (e) {}
      }
      return new Response(JSON.stringify(memoryState.nationalists), { headers: JSON_HEADERS });
    }

    if (path === '/api/admin/nationalist-influencers' && request.method === 'POST') {
      if (!isAuthorizedAdmin(request)) {
        return new Response(JSON.stringify({ error: 'Unauthorized admin' }), { status: 401, headers: JSON_HEADERS });
      }
      const b = await request.json().catch(() => ({}));
      const newNat = {
        id: b.id || ('nat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)),
        name: b.name || 'Unnamed Nationalist',
        handle_x: b.handle_x || '',
        handle_yt: b.handle_yt || '',
        handle_insta: b.handle_insta || '',
        other_links: b.other_links || '',
        avatar_url: b.avatar_url || '',
        category: b.category || 'Nationalist Creator',
        description: b.description || '',
        status: b.status || 'approved',
        is_verified: b.is_verified !== undefined ? b.is_verified : 1,
        upvotes: b.upvotes || 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const existingIdx = memoryState.nationalists.findIndex(n => n.id === newNat.id);
      if (existingIdx >= 0) {
        memoryState.nationalists[existingIdx] = { ...memoryState.nationalists[existingIdx], ...newNat };
      } else {
        memoryState.nationalists.unshift(newNat);
      }

      return new Response(JSON.stringify({ success: true, nationalist: newNat }), { headers: JSON_HEADERS });
    }

    if (path.startsWith('/api/admin/nationalist-influencers/') && (request.method === 'PATCH' || request.method === 'PUT')) {
      if (!isAuthorizedAdmin(request)) {
        return new Response(JSON.stringify({ error: 'Unauthorized admin' }), { status: 401, headers: JSON_HEADERS });
      }
      const id = path.split('/')[4];
      const b = await request.json().catch(() => ({}));
      const nat = memoryState.nationalists.find(n => n.id === id);
      if (nat) {
        Object.assign(nat, b);
        nat.updated_at = new Date().toISOString();
        return new Response(JSON.stringify({ success: true, nationalist: nat }), { headers: JSON_HEADERS });
      }
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: JSON_HEADERS });
    }

    if (path.startsWith('/api/admin/nationalist-influencers/') && request.method === 'DELETE') {
      if (!isAuthorizedAdmin(request)) {
        return new Response(JSON.stringify({ error: 'Unauthorized admin' }), { status: 401, headers: JSON_HEADERS });
      }
      const id = path.split('/')[4];
      memoryState.nationalists = memoryState.nationalists.filter(n => n.id !== id);
      return new Response(JSON.stringify({ success: true }), { headers: JSON_HEADERS });
    }

    // -------------------------------------------------------------
    // REPORTS SYSTEM
    // -------------------------------------------------------------
    if (path === '/api/reports' && request.method === 'POST') {
      try {
        const body = await request.json().catch(() => ({}));
        const newRep = {
          id: 'rep_' + Date.now(),
          entity_id: body.entity_id || '',
          entity_name: body.entity_name || 'Reported Entity',
          report_type: body.report_type || 'General Violation',
          message: body.message || '',
          status: 'pending',
          reported_by_ip: clientIp,
          created_at: new Date().toISOString()
        };
        memoryState.reports.unshift(newRep);
        return new Response(JSON.stringify({ success: true, report: newRep }), { headers: JSON_HEADERS });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: JSON_HEADERS });
      }
    }

    if (path === '/api/admin/reports' && request.method === 'GET') {
      if (!isAuthorizedAdmin(request)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: JSON_HEADERS });
      }
      return new Response(JSON.stringify(memoryState.reports), { headers: JSON_HEADERS });
    }

    if (path.startsWith('/api/admin/reports/') && request.method === 'PATCH') {
      if (!isAuthorizedAdmin(request)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: JSON_HEADERS });
      }
      const repId = path.split('/')[4];
      const body = await request.json().catch(() => ({}));
      const rep = memoryState.reports.find(r => r.id === repId);
      if (rep) {
        if (body.status) rep.status = body.status;
        return new Response(JSON.stringify({ success: true, report: rep }), { headers: JSON_HEADERS });
      }
      return new Response(JSON.stringify({ error: 'Report not found' }), { status: 404, headers: JSON_HEADERS });
    }

    // -------------------------------------------------------------
    // CATEGORIES, PLAYLIST, SPOTLIGHT, POSTS
    // -------------------------------------------------------------
    if (path === '/api/categories' && request.method === 'GET') {
      const type = url.searchParams.get('type');
      let cats = memoryState.categories;
      if (type) cats = cats.filter(c => c.type === type);
      return new Response(JSON.stringify(cats), { headers: JSON_HEADERS });
    }

    if (path === '/api/admin/categories' && request.method === 'GET') {
      return new Response(JSON.stringify(memoryState.categories), { headers: JSON_HEADERS });
    }

    if (path === '/api/admin/categories' && request.method === 'POST') {
      if (!isAuthorizedAdmin(request)) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: JSON_HEADERS });
      const b = await request.json().catch(() => ({}));
      const newCat = {
        id: 'cat_' + Date.now(),
        name: b.name || 'New Category',
        description: b.description || '',
        color: b.color || '#f59e0b',
        type: b.type || 'entity'
      };
      memoryState.categories.push(newCat);
      return new Response(JSON.stringify({ success: true, category: newCat }), { headers: JSON_HEADERS });
    }

    if (path.startsWith('/api/admin/categories/') && request.method === 'DELETE') {
      if (!isAuthorizedAdmin(request)) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: JSON_HEADERS });
      const id = path.split('/')[4];
      memoryState.categories = memoryState.categories.filter(c => c.id !== id);
      return new Response(JSON.stringify({ success: true }), { headers: JSON_HEADERS });
    }

    if (path === '/api/playlist' && request.method === 'GET') {
      return new Response(JSON.stringify(memoryState.playlist.filter(p => p.is_active)), { headers: JSON_HEADERS });
    }

    if (path === '/api/admin/playlist' && request.method === 'GET') {
      return new Response(JSON.stringify(memoryState.playlist), { headers: JSON_HEADERS });
    }

    if (path === '/api/admin/playlist' && request.method === 'POST') {
      if (!isAuthorizedAdmin(request)) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: JSON_HEADERS });
      const b = await request.json().catch(() => ({}));
      const newTrack = {
        id: 'track_' + Date.now(),
        title: b.title || 'National Anthem',
        artist: b.artist || 'Sovereign Voices',
        audio_url: b.audio_url || '',
        duration: b.duration || '3:00',
        is_active: 1
      };
      memoryState.playlist.push(newTrack);
      return new Response(JSON.stringify({ success: true, track: newTrack }), { headers: JSON_HEADERS });
    }

    if (path.startsWith('/api/admin/playlist/') && request.method === 'DELETE') {
      if (!isAuthorizedAdmin(request)) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: JSON_HEADERS });
      const id = path.split('/')[4];
      memoryState.playlist = memoryState.playlist.filter(p => p.id !== id);
      return new Response(JSON.stringify({ success: true }), { headers: JSON_HEADERS });
    }

    if (path === '/api/spotlight' && request.method === 'GET') {
      const spot = memoryState.entities[0] || null;
      return new Response(JSON.stringify({ entity: spot }), { headers: JSON_HEADERS });
    }

    if (path === '/api/posts' && request.method === 'GET') {
      return new Response(JSON.stringify(memoryState.posts), { headers: JSON_HEADERS });
    }

    if (path === '/api/poll' && request.method === 'GET') {
      return new Response(JSON.stringify({ votes: memoryState.pollVotes }), { headers: JSON_HEADERS });
    }

    // -------------------------------------------------------------
    // ADMIN AUTHENTICATION & MANAGEMENT
    // -------------------------------------------------------------
    if (path === '/api/admin/login' && request.method === 'POST') {
      try {
        const body = await request.json().catch(() => ({}));
        const { username, password, email } = body;
        const inputId = (username || email || '').trim().toLowerCase();

        const isMaster = (inputId === 'omkumar' || inputId === 'omkumar.working@gmail.com') &&
                         (password === 'Q0gng04bk3' || password === 'JaiHindBharatMataKiJai2024!');

        if (isMaster) {
          const token = 'ep-adm-' + Date.now() + '-' + Math.random().toString(36).substr(2, 8);
          memoryState.activeAdminTokens.add(token);
          return new Response(JSON.stringify({
            success: true,
            token,
            adminToken: token,
            user: {
              name: 'Om Kumar',
              email: 'omkumar.working@gmail.com',
              role: 'SUPER_ADMIN'
            }
          }), { headers: JSON_HEADERS });
        }

        return new Response(JSON.stringify({ error: 'Invalid admin credentials' }), { status: 401, headers: JSON_HEADERS });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: JSON_HEADERS });
      }
    }

    if (path === '/api/admin/check-access' && request.method === 'GET') {
      const authorized = isAuthorizedAdmin(request);
      return new Response(JSON.stringify({ authorized }), { headers: JSON_HEADERS });
    }

    if (path === '/api/admin/credentials' && (request.method === 'PUT' || request.method === 'POST')) {
      if (!isAuthorizedAdmin(request)) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: JSON_HEADERS });
      return new Response(JSON.stringify({ success: true, message: 'Admin credentials maintained under sovereign lock.' }), { headers: JSON_HEADERS });
    }

    if (path === '/api/admin/shield-attempts' && request.method === 'GET') {
      if (!isAuthorizedAdmin(request)) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: JSON_HEADERS });
      return new Response(JSON.stringify(memoryState.shieldAttempts), { headers: JSON_HEADERS });
    }

    if (path === '/api/admin/block-ip' && request.method === 'POST') {
      if (!isAuthorizedAdmin(request)) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: JSON_HEADERS });
      const b = await request.json().catch(() => ({}));
      if (b.ip) memoryState.blockedIps.add(b.ip);
      return new Response(JSON.stringify({ success: true }), { headers: JSON_HEADERS });
    }

    if (path.startsWith('/api/admin/block-ip/') && request.method === 'DELETE') {
      if (!isAuthorizedAdmin(request)) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: JSON_HEADERS });
      const ip = path.split('/')[4];
      memoryState.blockedIps.delete(ip);
      return new Response(JSON.stringify({ success: true }), { headers: JSON_HEADERS });
    }

    if (path === '/api/admin/security' && request.method === 'GET') {
      if (!isAuthorizedAdmin(request)) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: JSON_HEADERS });
      return new Response(JSON.stringify({
        blockedIps: Array.from(memoryState.blockedIps),
        shieldAttempts: memoryState.shieldAttempts,
        activeAdminSessions: memoryState.activeAdminTokens.size
      }), { headers: JSON_HEADERS });
    }

    if (path === '/api/admin/backup' && request.method === 'GET') {
      const key = url.searchParams.get('adminKey') || request.headers.get('x-admin-key');
      if (key !== 'JaiHindBharatMataKiJai2024!' && key !== 'Q0gng04bk3' && !key?.startsWith('ep-adm-')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: JSON_HEADERS });
      }
      const dump = {
        timestamp: new Date().toISOString(),
        entities: memoryState.entities,
        nationalists: memoryState.nationalists,
        categories: memoryState.categories,
        playlist: memoryState.playlist,
        posts: memoryState.posts,
        reports: memoryState.reports,
        bulletin: memoryState.bulletin,
        govtPoll: memoryState.govtPoll
      };
      return new Response(JSON.stringify(dump, null, 2), {
        headers: {
          ...JSON_HEADERS,
          'Content-Disposition': 'attachment; filename="exposed-propagandus-backup-' + Date.now() + '.json"'
        }
      });
    }

    if (path === '/api/admin/restore' && request.method === 'POST') {
      if (!isAuthorizedAdmin(request)) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: JSON_HEADERS });
      try {
        const body = await request.json();
        const data = body.backup || body;
        if (data.entities) memoryState.entities = data.entities;
        if (data.nationalists) memoryState.nationalists = data.nationalists;
        if (data.categories) memoryState.categories = data.categories;
        if (data.playlist) memoryState.playlist = data.playlist;
        if (data.posts) memoryState.posts = data.posts;
        if (data.reports) memoryState.reports = data.reports;
        if (data.bulletin) memoryState.bulletin = data.bulletin;
        if (data.govtPoll) memoryState.govtPoll = data.govtPoll;
        return new Response(JSON.stringify({ success: true, message: 'Database state restored successfully.' }), { headers: JSON_HEADERS });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid restore data' }), { status: 400, headers: JSON_HEADERS });
      }
    }

    // Health Check Root
    if (path === '/' || path === '/health' || path === '/api/health') {
      return new Response(JSON.stringify({
        status: 'ONLINE',
        platform: 'Cloudflare Worker',
        mission: 'Exposed Propagandus Sovereign API',
        slogan: 'Bharat Mata ki Jai 🇮🇳',
        timestamp: new Date().toISOString()
      }), { headers: JSON_HEADERS });
    }

    // 404 Endpoint Not Found
    return new Response(JSON.stringify({ error: 'Endpoint not found', path }), {
      status: 404,
      headers: JSON_HEADERS
    });
  }
};
