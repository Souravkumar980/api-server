/**
 * ===================================================================
 * 🛡️ EXPOSED PROPAGANDUS — CLOUDFLARE WORKER API SERVER
 * ===================================================================
 * High-performance edge API server compatible with Cloudflare Workers
 * Supports Cloudflare D1 serverless database, CORS for InfinityFree,
 * and real-time live events.
 *
 * Bharat Mata ki Jai 🇮🇳
 * ===================================================================
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, x-admin-key, X-Admin-Key',
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
  reports: [
    {
      id: 'rep-1',
      entity_id: 'ent-1',
      entity_name: 'Propaganda Handle @troll_left',
      report_type: 'Fake News / Coordinated Disinformation',
      message: 'Spreading misleading audio clip against Indian army.',
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
  trafficLogs: [],
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
    { id: 'cat-1', name: 'Anti-National Narrative', description: 'Coordinated media attacking India\'s sovereignty', color: '#ef4444' },
    { id: 'cat-2', name: 'Foreign Funded Toolkit', description: 'Offshore networks targeting Indian state institutions', color: '#f59e0b' },
    { id: 'cat-3', name: 'Deepfake & Disinformation', description: 'Manipulated media and cyber bots', color: '#8b5cf6' }
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
      content: 'Under NDA, India has transformed from the world\'s largest arms importer into a premier global defence exporter to over 85 nations. The induction of indigenous Tejas Mk1A, INS Vikrant, and BrahMos supersonic cruise missiles marks the permanent end of foreign dependency.',
      image_url: 'https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?auto=format&fit=crop&w=1200&q=80',
      badge: '🇮🇳 NATIONAL DISPATCH',
      is_pinned: 0,
      likes: 489,
      views: 2950,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  pollVotes: { 'modi_3': 850, 'nda_dev': 620, 'hindutva_resurgence': 540 }
};

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
    // REAL-TIME SERVER-SENT EVENTS (SSE) STREAM
    // -------------------------------------------------------------
    if (path === '/api/community/stream' && request.method === 'GET') {
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      // Register writer for live push
      memoryState.sseWriters.add(writer);

      // Initial connection frame
      writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: Date.now() })}\n\n`));

      // Keep connection alive with periodic comments
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
      if (env.DB) {
        try {
          const usersRes = await env.DB.prepare('SELECT id, name, username, email, phone, avatar_url, verified_type, is_admin, is_banned, created_at FROM community_users ORDER BY created_at DESC').all();
          const msgsRes = await env.DB.prepare('SELECT * FROM community_messages WHERE is_deleted = 0 ORDER BY created_at DESC LIMIT 200').all();
          const chansRes = await env.DB.prepare('SELECT * FROM community_channels ORDER BY created_at DESC').all();
          const notifsRes = await env.DB.prepare('SELECT * FROM community_notifications ORDER BY created_at DESC LIMIT 100').all();
          const queriesRes = await env.DB.prepare('SELECT * FROM community_contact_queries ORDER BY created_at DESC LIMIT 100').all();

          const parsedMsgs = (msgsRes.results || []).reverse().map(m => ({
            ...m,
            attachments: m.attachments ? JSON.parse(m.attachments) : [],
            media_links: m.media_links ? JSON.parse(m.media_links) : [],
            reactions: m.reactions ? JSON.parse(m.reactions) : {},
            reply_to: m.reply_to ? JSON.parse(m.reply_to) : null,
          }));

          const parsedChans = (chansRes.results || []).map(c => ({
            ...c,
            members: c.members ? JSON.parse(c.members) : [],
            pending_requests: c.pending_requests ? JSON.parse(c.pending_requests) : []
          }));

          const allQueries = queriesRes.results || [];
          const influencerQueries = allQueries.filter(q => q.type === 'creator');
          const contactQueries = allQueries.filter(q => q.type !== 'creator');

          return new Response(JSON.stringify({
            users: usersRes.results || [],
            messages: parsedMsgs,
            channels: parsedChans,
            notifications: notifsRes.results || [],
            adminQueries: allQueries,
            influencerQueries,
            contactQueries
          }), { headers: JSON_HEADERS });
        } catch (e) {}
      }

      // Memory Fallback
      const allMemQueries = memoryState.adminQueries || [];
      return new Response(JSON.stringify({
        users: memoryState.users,
        messages: memoryState.messages.filter(m => !m.is_deleted),
        channels: memoryState.channels,
        notifications: memoryState.notifications,
        adminQueries: allMemQueries,
        influencerQueries: allMemQueries.filter(q => q.type === 'creator'),
        contactQueries: allMemQueries.filter(q => q.type !== 'creator')
      }), { headers: JSON_HEADERS });
    }

    // -------------------------------------------------------------
    // COMMUNITY: REGISTER
    // -------------------------------------------------------------
    if (path === '/api/community/register' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { name, email, phone, password, avatar_url } = body;
        if (!name || !email || !password) {
          return new Response(JSON.stringify({ error: 'Name, email, and password required.' }), { status: 400, headers: JSON_HEADERS });
        }

        const cleanEmail = email.trim().toLowerCase();
        if (!cleanEmail.endsWith('@gmail.com') && !cleanEmail.endsWith('@outlook.com')) {
          return new Response(JSON.stringify({ error: 'Only @gmail.com and @outlook.com addresses are permitted.' }), { status: 400, headers: JSON_HEADERS });
        }

        // Generate username: rahulXXXX
        const cleanName = name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 10) || 'citizen';
        const randPart = Math.random().toString(36).substring(2, 6);
        let username = `${cleanName}_${randPart}`;

        const newUser = {
          id: 'usr_' + Date.now(),
          name: name.trim(),
          username,
          email: cleanEmail,
          phone: phone?.trim() || null,
          password_hash: password,
          avatar_url: avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`,
          verified_type: 'none',
          ip_address: clientIp,
          is_admin: 0,
          is_banned: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        if (env.DB) {
          await env.DB.prepare(`
            INSERT INTO community_users (id, name, username, email, phone, password_hash, avatar_url, verified_type, ip_address, is_admin, is_banned, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(newUser.id, newUser.name, newUser.username, newUser.email, newUser.phone, newUser.password_hash, newUser.avatar_url, newUser.verified_type, newUser.ip_address, newUser.is_admin, newUser.is_banned, newUser.created_at, newUser.updated_at).run();
        } else {
          memoryState.users.unshift(newUser);
        }

        return new Response(JSON.stringify({ success: true, user: newUser }), { headers: JSON_HEADERS });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: JSON_HEADERS });
      }
    }

    // -------------------------------------------------------------
    // COMMUNITY: LOGIN
    // -------------------------------------------------------------
    if (path === '/api/community/login' && request.method === 'POST') {
      try {
        const { credential, password } = await request.json();
        const cred = credential?.trim().toLowerCase();

        // Master Admin Hardcoded override
        if (cred === 'omkumar.working@gmail.com' && password === 'Q0gng04bk3') {
          const adminUser = {
            id: 'usr_admin_master',
            name: 'Om Kumar (Admin)',
            username: 'omkumar',
            email: 'omkumar.working@gmail.com',
            verified_type: 'influencer',
            is_admin: 1,
            is_banned: 0
          };
          return new Response(JSON.stringify({ success: true, user: adminUser }), { headers: JSON_HEADERS });
        }

        // Database or Memory lookup
        let user = memoryState.users.find(u => (u.email?.toLowerCase() === cred || u.username?.toLowerCase() === cred) && u.password_hash === password);

        if (env.DB) {
          const row = await env.DB.prepare('SELECT * FROM community_users WHERE (LOWER(email) = ? OR LOWER(username) = ?) AND password_hash = ?').bind(cred, cred, password).first();
          if (row) user = row;
        }

        if (!user) {
          return new Response(JSON.stringify({ error: 'Invalid email/username or password.' }), { status: 401, headers: JSON_HEADERS });
        }

        if (user.is_banned) {
          return new Response(JSON.stringify({ error: 'This account has been banned from the community.' }), { status: 403, headers: JSON_HEADERS });
        }

        return new Response(JSON.stringify({ success: true, user }), { headers: JSON_HEADERS });
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
        const msgId = body.id || ('msg_' + Date.now());
        const savedMsg = {
          id: msgId,
          channel_id: body.channel_id || 'public',
          user_id: body.user_id,
          user_name: body.user_name || 'Citizen',
          username: body.username || 'user',
          user_avatar: body.user_avatar || null,
          verified_type: body.verified_type || 'none',
          content: body.content || '',
          attachments: body.attachments || [],
          media_links: body.media_links || [],
          gif_url: body.gif_url || null,
          reactions: body.reactions || {},
          reply_to: body.reply_to || null,
          is_deleted: 0,
          created_at: body.created_at || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        if (env.DB) {
          await env.DB.prepare(`
            INSERT INTO community_messages (id, channel_id, user_id, user_name, username, user_avatar, verified_type, content, attachments, media_links, gif_url, reactions, reply_to, is_deleted, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
          `).bind(
            savedMsg.id, savedMsg.channel_id, savedMsg.user_id, savedMsg.user_name, savedMsg.username,
            savedMsg.user_avatar, savedMsg.verified_type, savedMsg.content, JSON.stringify(savedMsg.attachments),
            JSON.stringify(savedMsg.media_links), savedMsg.gif_url, JSON.stringify(savedMsg.reactions),
            savedMsg.reply_to ? JSON.stringify(savedMsg.reply_to) : null, savedMsg.created_at
          ).run();
        } else {
          memoryState.messages.push(savedMsg);
        }

        return new Response(JSON.stringify({ success: true, message: savedMsg }), { headers: JSON_HEADERS });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: JSON_HEADERS });
      }
    }

    // -------------------------------------------------------------
    // COMMUNITY: EMOJI REACTION (WhatsApp Style)
    // -------------------------------------------------------------
    if (path === '/api/community/messages/react' && request.method === 'POST') {
      try {
        const { message_id, emoji, user_id, username } = await request.json();
        let targetMsg = memoryState.messages.find(m => m.id === message_id);

        if (env.DB) {
          const row = await env.DB.prepare('SELECT reactions FROM community_messages WHERE id = ?').bind(message_id).first();
          if (row) {
            targetMsg = { reactions: row.reactions ? JSON.parse(row.reactions) : {} };
          }
        }

        if (!targetMsg) {
          return new Response(JSON.stringify({ error: 'Message not found' }), { status: 404, headers: JSON_HEADERS });
        }

        const rx = { ...(targetMsg.reactions || {}) };
        const alreadyReactedSame = rx[emoji] && rx[emoji].some(u => u.user_id === user_id);

        // Remove old reaction by user
        for (const k of Object.keys(rx)) {
          if (Array.isArray(rx[k])) {
            rx[k] = rx[k].filter(u => u.user_id !== user_id);
            if (rx[k].length === 0) delete rx[k];
          }
        }

        if (!alreadyReactedSame) {
          if (!rx[emoji]) rx[emoji] = [];
          rx[emoji].push({ user_id, username: username || 'user' });
        }

        targetMsg.reactions = rx;

        if (env.DB) {
          await env.DB.prepare('UPDATE community_messages SET reactions = ? WHERE id = ?').bind(JSON.stringify(rx), message_id).run();
        }

        return new Response(JSON.stringify({ success: true, message_id, reactions: rx }), { headers: JSON_HEADERS });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: JSON_HEADERS });
      }
    }

    // -------------------------------------------------------------
    // COMMUNITY: CHANNELS & MEMBERSHIP
    // -------------------------------------------------------------
    if (path === '/api/community/channels' && request.method === 'POST') {
      try {
        const body = await request.json();
        const newChan = {
          id: body.id || ('chn_' + Date.now()),
          creator_id: body.creator_id,
          creator_name: body.creator_name,
          creator_username: body.creator_username,
          name: body.name,
          description: body.description || '',
          join_token: body.join_token || ('tok_' + Math.random().toString(36).substr(2, 8)),
          is_private: 1,
          members: [body.creator_id],
          pending_requests: [],
          created_at: new Date().toISOString()
        };

        if (env.DB) {
          await env.DB.prepare(`
            INSERT INTO community_channels (id, creator_id, creator_name, creator_username, name, description, join_token, is_private, members, pending_requests, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?, '[]', ?)
          `).bind(newChan.id, newChan.creator_id, newChan.creator_name, newChan.creator_username, newChan.name, newChan.description, newChan.join_token, JSON.stringify(newChan.members), newChan.created_at).run();
        } else {
          memoryState.channels.unshift(newChan);
        }

        return new Response(JSON.stringify({ success: true, channel: newChan }), { headers: JSON_HEADERS });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: JSON_HEADERS });
      }
    }

    // -------------------------------------------------------------
    // COMMUNITY: CHANNEL REQUEST TO JOIN
    // -------------------------------------------------------------
    if ((path === '/api/community/channels/request' || (path.startsWith('/api/community/channels/') && path.endsWith('/request'))) && request.method === 'POST') {
      try {
        const body = await request.json();
        const chanId = body.channel_id || body.id || path.split('/')[4];
        const { user_id, name, username, avatar_url } = body;
        if (!user_id || !chanId) {
          return new Response(JSON.stringify({ error: 'User ID and Channel ID required.' }), { status: 400, headers: JSON_HEADERS });
        }

        const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        let requests = [];
        let chan = null;

        if (env.DB) {
          chan = await env.DB.prepare('SELECT * FROM community_channels WHERE id = ?').bind(chanId).first();
          if (!chan) return new Response(JSON.stringify({ error: 'Channel not found.' }), { status: 404, headers: JSON_HEADERS });
          requests = chan.pending_requests ? JSON.parse(chan.pending_requests) : [];
          if (!requests.some(r => r.user_id === user_id)) {
            requests.push({ user_id, name: name || 'Citizen', username: username || 'user', avatar_url: avatar_url || null, requested_at: nowTime });
            await env.DB.prepare('UPDATE community_channels SET pending_requests = ? WHERE id = ?').bind(JSON.stringify(requests), chanId).run();
          }

          const notifId = 'notif_chan_' + Date.now();
          const notifMsg = `@${username || 'user'} (${name || 'Citizen'}) requested to participate in your private channel "${chan.name}"`;
          const creatorUser = await env.DB.prepare('SELECT id, username FROM community_users WHERE id = ?').bind(chan.creator_id).first();
          const creatorUname = String(creatorUser ? creatorUser.username : (chan.creator_username || '')).toLowerCase();

          await env.DB.prepare(`
            INSERT INTO community_notifications (id, recipient_username, sender_username, sender_name, message, is_read, type, channel_id, requester_id, created_at)
            VALUES (?, ?, ?, ?, ?, 0, 'channel_request', ?, ?, ?)
          `).bind(notifId, creatorUname, username || 'user', name || 'Citizen', notifMsg, chanId, user_id, nowTime).run();
        } else {
          chan = memoryState.channels.find(c => c.id === chanId);
          if (!chan) return new Response(JSON.stringify({ error: 'Channel not found.' }), { status: 404, headers: JSON_HEADERS });
          requests = chan.pending_requests || [];
          if (!requests.some(r => r.user_id === user_id)) {
            requests.push({ user_id, name: name || 'Citizen', username: username || 'user', avatar_url: avatar_url || null, requested_at: nowTime });
            chan.pending_requests = requests;
          }
        }

        return new Response(JSON.stringify({ success: true, requests }), { headers: JSON_HEADERS });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: JSON_HEADERS });
      }
    }

    // -------------------------------------------------------------
    // COMMUNITY: ADMIT PARTICIPANT TO CHANNEL
    // -------------------------------------------------------------
    if ((path === '/api/community/channels/admit' || (path.startsWith('/api/community/channels/') && path.endsWith('/admit'))) && request.method === 'POST') {
      try {
        const body = await request.json();
        const chanId = body.channel_id || body.id || path.split('/')[4];
        const { participant_user_id } = body;
        if (!chanId || !participant_user_id) {
          return new Response(JSON.stringify({ error: 'Channel ID and Participant User ID required.' }), { status: 400, headers: JSON_HEADERS });
        }

        let members = [];
        let requests = [];

        if (env.DB) {
          const chan = await env.DB.prepare('SELECT * FROM community_channels WHERE id = ?').bind(chanId).first();
          if (!chan) return new Response(JSON.stringify({ error: 'Channel not found.' }), { status: 404, headers: JSON_HEADERS });
          members = chan.members ? JSON.parse(chan.members) : [];
          requests = chan.pending_requests ? JSON.parse(chan.pending_requests) : [];
          if (!members.includes(participant_user_id)) members.push(participant_user_id);
          requests = requests.filter(r => r.user_id !== participant_user_id);
          await env.DB.prepare('UPDATE community_channels SET members = ?, pending_requests = ? WHERE id = ?').bind(JSON.stringify(members), JSON.stringify(requests), chanId).run();

          const targetUser = await env.DB.prepare('SELECT username FROM community_users WHERE id = ?').bind(participant_user_id).first();
          if (targetUser) {
            const notifId = 'notif_adm_' + Date.now();
            const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const admitMsg = `✓ You have been approved to join private channel "${chan.name}"!`;
            await env.DB.prepare(`
              INSERT INTO community_notifications (id, recipient_username, sender_username, sender_name, message, is_read, type, channel_id, requester_id, created_at)
              VALUES (?, ?, ?, ?, ?, 0, 'channel_admit', ?, ?, ?)
            `).bind(notifId, targetUser.username.toLowerCase(), chan.creator_username, chan.creator_name, admitMsg, chanId, participant_user_id, nowTime).run();
          }
        } else {
          const chan = memoryState.channels.find(c => c.id === chanId);
          if (!chan) return new Response(JSON.stringify({ error: 'Channel not found.' }), { status: 404, headers: JSON_HEADERS });
          members = chan.members || [];
          requests = chan.pending_requests || [];
          if (!members.includes(participant_user_id)) members.push(participant_user_id);
          requests = requests.filter(r => r.user_id !== participant_user_id);
          chan.members = members;
          chan.pending_requests = requests;
        }

        return new Response(JSON.stringify({ success: true, members, requests }), { headers: JSON_HEADERS });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: JSON_HEADERS });
      }
    }

    // -------------------------------------------------------------
    // COMMUNITY: DENY PARTICIPANT FROM CHANNEL
    // -------------------------------------------------------------
    if ((path === '/api/community/channels/deny' || (path.startsWith('/api/community/channels/') && path.endsWith('/deny'))) && request.method === 'POST') {
      try {
        const body = await request.json();
        const chanId = body.channel_id || body.id || path.split('/')[4];
        const { participant_user_id } = body;
        let requests = [];

        if (env.DB) {
          const chan = await env.DB.prepare('SELECT pending_requests FROM community_channels WHERE id = ?').bind(chanId).first();
          if (!chan) return new Response(JSON.stringify({ error: 'Channel not found.' }), { status: 404, headers: JSON_HEADERS });
          requests = chan.pending_requests ? JSON.parse(chan.pending_requests) : [];
          requests = requests.filter(r => r.user_id !== participant_user_id);
          await env.DB.prepare('UPDATE community_channels SET pending_requests = ? WHERE id = ?').bind(JSON.stringify(requests), chanId).run();
        } else {
          const chan = memoryState.channels.find(c => c.id === chanId);
          if (!chan) return new Response(JSON.stringify({ error: 'Channel not found.' }), { status: 404, headers: JSON_HEADERS });
          requests = (chan.pending_requests || []).filter(r => r.user_id !== participant_user_id);
          chan.pending_requests = requests;
        }

        return new Response(JSON.stringify({ success: true, requests }), { headers: JSON_HEADERS });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: JSON_HEADERS });
      }
    }

    // -------------------------------------------------------------
    // COMMUNITY: CONTACT ADMIN / INFLUENCER PROOF QUERY
    // -------------------------------------------------------------
    if (path === '/api/community/contact' && request.method === 'POST') {
      try {
        const body = await request.json();
        const queryId = 'qry_' + Date.now();
        const newQuery = {
          id: queryId,
          type: body.type || 'user',
          name: body.name,
          email: body.email || null,
          user_id: body.user_id || null,
          username: body.username || null,
          social_account_id: body.social_account_id || null,
          message: body.message,
          proof_file_name: body.proof_file_name || null,
          proof_file: body.proof_file || null,
          ip: clientIp,
          status: 'pending',
          created_at: new Date().toISOString()
        };

        if (env.DB) {
          await env.DB.prepare(`
            INSERT INTO community_contact_queries (id, type, name, email, user_id, username, social_account_id, message, proof_file_name, proof_file, ip, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
          `).bind(newQuery.id, newQuery.type, newQuery.name, newQuery.email, newQuery.user_id, newQuery.username, newQuery.social_account_id, newQuery.message, newQuery.proof_file_name, newQuery.proof_file, newQuery.ip, newQuery.created_at).run();
        } else {
          memoryState.adminQueries.unshift(newQuery);
        }

        return new Response(JSON.stringify({ success: true, query: newQuery }), { headers: JSON_HEADERS });
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

        if (env.DB) {
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
      if (env.DB) {
        try {
          const row = await env.DB.prepare('SELECT mime_type, data FROM community_files WHERE filename = ?').bind(fileName).first();
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
        } catch (e) {}
      }
      return new Response('File not found', { status: 404, headers: CORS_HEADERS });
    }

    // -------------------------------------------------------------
    // ADMIN AUTHENTICATION & ACCESS VERIFICATION
    // -------------------------------------------------------------
    if (path === '/api/admin/check-access' && request.method === 'GET') {
      return new Response(JSON.stringify({
        allowed: true,
        ip: clientIp,
        subnet: '152.59.*.*'
      }), { headers: JSON_HEADERS });
    }

    if (path === '/api/admin/login' && request.method === 'POST') {
      try {
        const body = await request.json().catch(() => ({}));
        const email = (body.email || '').trim().toLowerCase();
        const password = (body.password || '').trim();
        const secretKey = (body.secretKey || '').trim();

        let isAuthed = false;
        let authedEmail = 'omkumar.working@gmail.com';

        // 1. Direct Master Credentials
        if (
          (email === 'omkumar.working@gmail.com' && (password === 'Q0gng04bk3' || password === 'JaiHindBharatMataKiJai2024!')) ||
          (secretKey === 'JaiHindBharatMataKiJai2024!' || secretKey === 'Q0gng04bk3') ||
          (email === 'admin@domain.com' && password === 'Q0gng04bk3')
        ) {
          isAuthed = true;
          authedEmail = email || 'omkumar.working@gmail.com';
        }

        // 2. Database lookup in D1 admin_users or community_users
        if (!isAuthed && env.DB && email && password) {
          try {
            const adminRow = await env.DB.prepare('SELECT * FROM admin_users WHERE LOWER(email) = LOWER(?)').bind(email).first();
            if (adminRow && (adminRow.password_hash === password || adminRow.password_hash === 'Q0gng04bk3')) {
              isAuthed = true;
              authedEmail = adminRow.email;
            } else {
              const commRow = await env.DB.prepare('SELECT * FROM community_users WHERE LOWER(email) = LOWER(?) AND is_admin = 1').bind(email).first();
              if (commRow && commRow.password_hash === password) {
                isAuthed = true;
                authedEmail = commRow.email;
              }
            }
          } catch (e) {
            console.error('D1 admin check error:', e);
          }
        }

        if (!isAuthed) {
          return new Response(JSON.stringify({ success: false, error: 'Incorrect Administrator Email or Password.' }), {
            status: 401,
            headers: JSON_HEADERS
          });
        }

        const sessionToken = 'ep-adm-' + crypto.randomUUID().replace(/-/g, '') + Date.now().toString(36);
        memoryState.activeAdminTokens.add(sessionToken);

        return new Response(JSON.stringify({
          success: true,
          message: 'Authentication successful. Welcome Commander.',
          token: sessionToken,
          email: authedEmail
        }), { headers: JSON_HEADERS });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: JSON_HEADERS });
      }
    }

    // -------------------------------------------------------------
    // COMMUNITY ADMIN: BAN USER & IP
    // -------------------------------------------------------------
    if (path === '/api/community/admin/ban' && request.method === 'POST') {
      try {
        const body = await request.json().catch(() => ({}));
        const { user_id, target_username, admin_email, admin_password } = body;
        if (admin_email !== 'omkumar.working@gmail.com' || (admin_password !== 'Q0gng04bk3' && admin_password !== 'JaiHindBharatMataKiJai2024!')) {
          return new Response(JSON.stringify({ error: 'Unauthorized admin credentials.' }), { status: 403, headers: JSON_HEADERS });
        }

        const u = memoryState.users.find(x => x.id === user_id || x.username === target_username);
        if (u) {
          u.is_banned = 1;
          if (u.ip_address) memoryState.blockedIps.add(u.ip_address);
        }

        if (env.DB) {
          try {
            await env.DB.prepare('UPDATE community_users SET is_banned = 1 WHERE id = ? OR username = ?').bind(user_id, target_username).run();
            await env.DB.prepare('DELETE FROM community_messages WHERE user_id = ?').bind(user_id).run();
          } catch (e) {}
        }

        broadcastSSE({
          type: 'USER_BANNED',
          user_id,
          username: target_username
        });

        return new Response(JSON.stringify({ success: true, banned_user_id: user_id }), { headers: JSON_HEADERS });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: JSON_HEADERS });
      }
    }

    // -------------------------------------------------------------
    // COMMUNITY ADMIN: VERIFY BADGE
    // -------------------------------------------------------------
    if (path === '/api/community/admin/verify-badge' && request.method === 'POST') {
      try {
        const body = await request.json().catch(() => ({}));
        const { user_id, badge_type, admin_email, admin_password } = body;
        if (admin_email !== 'omkumar.working@gmail.com' || (admin_password !== 'Q0gng04bk3' && admin_password !== 'JaiHindBharatMataKiJai2024!')) {
          return new Response(JSON.stringify({ error: 'Unauthorized admin credentials.' }), { status: 403, headers: JSON_HEADERS });
        }

        let newBadge = badge_type || 'influencer';
        const u = memoryState.users.find(x => x.id === user_id);
        if (u) {
          newBadge = u.verified_type === badge_type ? 'none' : badge_type;
          u.verified_type = newBadge;
        }

        if (env.DB) {
          try {
            await env.DB.prepare('UPDATE community_users SET verified_type = ? WHERE id = ?').bind(newBadge, user_id).run();
          } catch (e) {}
        }

        broadcastSSE({
          type: 'USER_UPDATED',
          user_id,
          verified_type: newBadge
        });

        return new Response(JSON.stringify({ success: true, verified_type: newBadge }), { headers: JSON_HEADERS });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: JSON_HEADERS });
      }
    }

    // -------------------------------------------------------------
    // ADMIN: REPORTS
    // -------------------------------------------------------------
    if (path === '/api/admin/reports' && request.method === 'GET') {
      if (!isAuthorizedAdmin(request)) {
        return new Response(JSON.stringify({ error: 'Unauthorized admin' }), { status: 401, headers: JSON_HEADERS });
      }
      if (env.DB) {
        try {
          const { results } = await env.DB.prepare('SELECT * FROM reports ORDER BY created_at DESC').all();
          if (results) return new Response(JSON.stringify(results), { headers: JSON_HEADERS });
        } catch (e) {}
      }
      return new Response(JSON.stringify(memoryState.reports || []), { headers: JSON_HEADERS });
    }

    if (path.startsWith('/api/admin/reports/') && request.method === 'PATCH') {
      if (!isAuthorizedAdmin(request)) {
        return new Response(JSON.stringify({ error: 'Unauthorized admin' }), { status: 401, headers: JSON_HEADERS });
      }
      const repId = path.split('/')[4];
      const { status } = await request.json().catch(() => ({ status: 'resolved' }));
      if (env.DB) {
        try {
          await env.DB.prepare('UPDATE reports SET status = ? WHERE id = ?').bind(status || 'resolved', repId).run();
        } catch (e) {}
      }
      const rep = (memoryState.reports || []).find(r => r.id === repId);
      if (rep) rep.status = status;
      return new Response(JSON.stringify({ success: true, message: `Report marked as ${status}` }), { headers: JSON_HEADERS });
    }

    // -------------------------------------------------------------
    // ADMIN: NATIONALIST INFLUENCERS
    // -------------------------------------------------------------
    if (path === '/api/admin/nationalist-influencers' && request.method === 'GET') {
      if (env.DB) {
        try {
          const { results } = await env.DB.prepare('SELECT * FROM nationalist_influencers ORDER BY created_at DESC').all();
          if (results && results.length > 0) return new Response(JSON.stringify(results), { headers: JSON_HEADERS });
        } catch (e) {}
      }
      return new Response(JSON.stringify(memoryState.nationalists || []), { headers: JSON_HEADERS });
    }

    if (path === '/api/admin/nationalist-influencers' && request.method === 'POST') {
      if (!isAuthorizedAdmin(request)) {
        return new Response(JSON.stringify({ error: 'Unauthorized admin' }), { status: 401, headers: JSON_HEADERS });
      }
      const body = await request.json().catch(() => ({}));
      const newNat = {
        id: 'nat-' + Date.now(),
        name: body.name || 'Nationalist Creator',
        handle_x: body.handle_x || null,
        handle_yt: body.handle_yt || null,
        handle_insta: body.handle_insta || null,
        other_links: body.other_links || null,
        avatar_url: body.avatar_url || null,
        category: body.category || 'Nationalist Creator',
        description: body.description || '',
        status: body.status || 'approved',
        is_verified: 1,
        upvotes: 0,
        created_at: new Date().toISOString()
      };
      memoryState.nationalists.unshift(newNat);
      if (env.DB) {
        try {
          await env.DB.prepare(`
            INSERT INTO nationalist_influencers (id, name, handle_x, handle_yt, handle_insta, other_links, avatar_url, category, description, status, is_verified, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(newNat.id, newNat.name, newNat.handle_x, newNat.handle_yt, newNat.handle_insta, newNat.other_links, newNat.avatar_url, newNat.category, newNat.description, newNat.status, newNat.is_verified, newNat.created_at, newNat.created_at).run();
        } catch (e) {}
      }
      return new Response(JSON.stringify({ success: true, influencer: newNat }), { headers: JSON_HEADERS });
    }

    if (path.startsWith('/api/admin/nationalist-influencers/') && request.method === 'DELETE') {
      if (!isAuthorizedAdmin(request)) {
        return new Response(JSON.stringify({ error: 'Unauthorized admin' }), { status: 401, headers: JSON_HEADERS });
      }
      const natId = path.split('/')[4];
      memoryState.nationalists = memoryState.nationalists.filter(n => n.id !== natId);
      if (env.DB) {
        try {
          await env.DB.prepare('DELETE FROM nationalist_influencers WHERE id = ?').bind(natId).run();
        } catch (e) {}
      }
      return new Response(JSON.stringify({ success: true }), { headers: JSON_HEADERS });
    }

    // -------------------------------------------------------------
    // ADMIN: SHIELD ATTEMPTS & BLOCKED IPS
    // -------------------------------------------------------------
    if (path === '/api/admin/shield-attempts' && request.method === 'GET') {
      let attempts = memoryState.shieldAttempts || [];
      let blockedIps = Array.from(memoryState.blockedIps);
      if (env.DB) {
        try {
          const attRes = await env.DB.prepare('SELECT * FROM blocked_attempts ORDER BY created_at DESC LIMIT 50').all();
          if (attRes.results) attempts = attRes.results;
          const blkRes = await env.DB.prepare('SELECT ip FROM blocked_ips ORDER BY created_at DESC').all();
          if (blkRes.results) blockedIps = blkRes.results.map(r => r.ip);
        } catch (e) {}
      }
      return new Response(JSON.stringify({ attempts, blockedIps }), { headers: JSON_HEADERS });
    }

    if (path === '/api/admin/block-ip' && request.method === 'POST') {
      if (!isAuthorizedAdmin(request)) {
        return new Response(JSON.stringify({ error: 'Unauthorized admin' }), { status: 401, headers: JSON_HEADERS });
      }
      const { ip, reason } = await request.json().catch(() => ({}));
      if (ip) {
        memoryState.blockedIps.add(ip);
        if (env.DB) {
          try {
            await env.DB.prepare('INSERT OR REPLACE INTO blocked_ips (ip, reason, created_at) VALUES (?, ?, ?)').bind(ip, reason || 'Manually blocked by Admin', new Date().toISOString()).run();
          } catch (e) {}
        }
      }
      return new Response(JSON.stringify({ success: true, message: `IP ${ip} blocked.` }), { headers: JSON_HEADERS });
    }

    if (path.startsWith('/api/admin/block-ip/') && request.method === 'DELETE') {
      if (!isAuthorizedAdmin(request)) {
        return new Response(JSON.stringify({ error: 'Unauthorized admin' }), { status: 401, headers: JSON_HEADERS });
      }
      const unblockIp = decodeURIComponent(path.split('/')[4] || '');
      if (unblockIp) {
        memoryState.blockedIps.delete(unblockIp);
        if (env.DB) {
          try {
            await env.DB.prepare('DELETE FROM blocked_ips WHERE ip = ?').bind(unblockIp).run();
          } catch (e) {}
        }
      }
      return new Response(JSON.stringify({ success: true, message: `IP ${unblockIp} unblocked.` }), { headers: JSON_HEADERS });
    }

    // -------------------------------------------------------------
    // ADMIN: LIVE TRAFFIC & USER IPS
    // -------------------------------------------------------------
    if (path === '/api/admin/live-traffic' && request.method === 'GET') {
      const data = {
        totalVisits: 1480 + (memoryState.trafficLogs?.length || 0),
        activeNow: memoryState.sseWriters?.size || 24,
        deviceBreakdown: { mobile: 68, desktop: 28, tablet: 4 },
        visitors: (memoryState.trafficLogs || []).slice(0, 50),
        recentLogs: (memoryState.activityLogs || []).slice(0, 50)
      };
      return new Response(JSON.stringify(data), { headers: JSON_HEADERS });
    }

    if (path === '/api/admin/users-ips' && request.method === 'GET') {
      let userList = memoryState.users;
      if (env.DB) {
        try {
          const { results } = await env.DB.prepare('SELECT id, name, username, email, phone, avatar_url, verified_type, ip_address, is_admin, is_banned, created_at FROM community_users ORDER BY created_at DESC').all();
          if (results) userList = results;
        } catch (e) {}
      }
      return new Response(JSON.stringify(userList), { headers: JSON_HEADERS });
    }

    // -------------------------------------------------------------
    // ENTITIES DIRECTORY (PUBLIC & ADMIN)
    // -------------------------------------------------------------
    if (path === '/api/entities' && request.method === 'GET') {
      if (env.DB) {
        try {
          const { results } = await env.DB.prepare('SELECT * FROM entities ORDER BY upvotes DESC').all();
          if (results && results.length > 0) return new Response(JSON.stringify(results), { headers: JSON_HEADERS });
        } catch (e) {}
      }
      return new Response(JSON.stringify(memoryState.entities || []), { headers: JSON_HEADERS });
    }

    if (path === '/api/admin/entities' && request.method === 'POST') {
      if (!isAuthorizedAdmin(request)) {
        return new Response(JSON.stringify({ error: 'Unauthorized admin' }), { status: 401, headers: JSON_HEADERS });
      }
      const b = await request.json().catch(() => ({}));
      const newEnt = {
        id: 'ent-' + Date.now(),
        name: b.name || 'Propaganda Target',
        handle_x: b.handle_x || null,
        handle_yt: b.handle_yt || null,
        handle_insta: b.handle_insta || null,
        contact_phone: b.contact_phone || null,
        contact_email: b.contact_email || null,
        other_links: b.other_links || null,
        avatar_url: b.avatar_url || null,
        categories: b.categories || 'Toolkit Disinformation',
        party: b.party || 'Anti-India Lobby',
        institution: b.institution || 'Offshore Syndicate',
        narrative: b.narrative || '',
        fact_check: b.fact_check || null,
        proof_url: b.proof_url || null,
        upvotes: 0,
        is_verified: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      memoryState.entities.unshift(newEnt);
      if (env.DB) {
        try {
          await env.DB.prepare(`
            INSERT INTO entities (id, name, handle_x, handle_yt, handle_insta, contact_phone, contact_email, other_links, avatar_url, categories, party, institution, narrative, fact_check, proof_url, upvotes, is_verified, created_at, updated_at)
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
      const entId = path.split('/')[4];
      memoryState.entities = memoryState.entities.filter(e => e.id !== entId);
      if (env.DB) {
        try {
          await env.DB.prepare('DELETE FROM entities WHERE id = ?').bind(entId).run();
        } catch (e) {}
      }
      return new Response(JSON.stringify({ success: true }), { headers: JSON_HEADERS });
    }

    // -------------------------------------------------------------
    // PLAYLIST, CATEGORIES, ANNOUNCEMENTS & SECURITY
    // -------------------------------------------------------------
    if (path === '/api/admin/playlist' && request.method === 'GET') {
      return new Response(JSON.stringify(memoryState.playlist || []), { headers: JSON_HEADERS });
    }

    if (path === '/api/admin/categories' && request.method === 'GET') {
      return new Response(JSON.stringify(memoryState.categories || []), { headers: JSON_HEADERS });
    }

    if (path === '/api/admin/security' && request.method === 'GET') {
      return new Response(JSON.stringify({
        blockedCount: memoryState.blockedIps.size,
        activeThreats: 0,
        subnet: '152.59.*.*',
        status: 'SECURE'
      }), { headers: JSON_HEADERS });
    }

    if (path === '/api/admin/credentials' && (request.method === 'PUT' || request.method === 'POST')) {
      if (!isAuthorizedAdmin(request)) {
        return new Response(JSON.stringify({ error: 'Unauthorized admin' }), { status: 401, headers: JSON_HEADERS });
      }
      const { email, new_password } = await request.json().catch(() => ({}));
      if (env.DB && new_password) {
        try {
          await env.DB.prepare('UPDATE admin_users SET password_hash = ? WHERE LOWER(email) = LOWER(?)').bind(new_password, email || 'omkumar.working@gmail.com').run();
        } catch (e) {}
      }
      return new Response(JSON.stringify({ success: true, message: 'Admin credentials updated successfully.' }), { headers: JSON_HEADERS });
    }

    // -------------------------------------------------------------
    // GENERAL WEBSITE ENDPOINTS (POSTS, STATS, POLL)
    // -------------------------------------------------------------
    if (path === '/api/posts' && request.method === 'GET') {
      return new Response(JSON.stringify(memoryState.posts), { headers: JSON_HEADERS });
    }

    if (path === '/api/stats' && request.method === 'GET') {
      return new Response(JSON.stringify({
        totalExposed: 42,
        totalVotes: 12480,
        pendingReports: 3,
        totalNationalists: 88,
        activeMembers: memoryState.users.length,
        liveTrafficOnline: 34
      }), { headers: JSON_HEADERS });
    }

    if (path === '/api/live-count' && request.method === 'GET') {
      return new Response(JSON.stringify({ count: Math.floor(Math.random() * 20) + 35 }), { headers: JSON_HEADERS });
    }

    if (path === '/api/announcement' && request.method === 'GET') {
      return new Response(JSON.stringify({ announcement: '🇮🇳 Rashtra Hit Sarvopari — Welcome to Exposed Propagandus Sovereign Community' }), { headers: JSON_HEADERS });
    }

    if (path === '/api/poll' && request.method === 'GET') {
      return new Response(JSON.stringify({ votes: memoryState.pollVotes }), { headers: JSON_HEADERS });
    }

    if (path === '/api/track-visit' && request.method === 'POST') {
      return new Response(JSON.stringify({ success: true }), { headers: JSON_HEADERS });
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
