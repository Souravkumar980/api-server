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
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
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

      // Initial connection frame
      writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: Date.now() })}\n\n`));

      // Keep connection alive with periodic comments
      const timer = setInterval(() => {
        try {
          writer.write(encoder.encode(': heartbeat\n\n'));
        } catch (e) {
          clearInterval(timer);
        }
      }, 15000);

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
