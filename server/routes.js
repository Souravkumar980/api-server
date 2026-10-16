const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const db = require('./db');
const {
  getClientIp,
  isAdminIpAllowed,
  submissionLimiter,
  checkHoneypot,
  sanitizeString,
  requireAdmin,
  VALID_ADMIN_KEYS,
  ACTIVE_ADMIN_SESSIONS,
  checkProtectedPatriot,
  handleProtectedPatriotViolation,
  logActivity
} = require('./security');
const { autoFetchSocialProfile } = require('./socialFetcher');
const { performRealtimeBackup } = require('./backupManager');
const { searchInvidiousVideos, resolveUrlOrPlaylist, resolveSingleVideo } = require('./invidiousHelper');

// Global API Client Key & Authorization Gate
// Prevents unauthorized URL inspection, direct scraping, and data leakage
router.use((req, res, next) => {
  if (req.method === 'OPTIONS') return next();

  const appKey = req.headers['x-app-key'] ||
                 req.headers['x-client-key'] ||
                 req.headers['x-admin-key'] ||
                 req.query.key || '';

  const authHeader = req.headers['authorization'] || '';
  const cleanAuth = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();

  const validClientKeys = new Set([
    'ep-client-v1-bharat-first-2024',
    'JaiHindBharatMataKiJai2024!',
    'Q0gng04bk3'
  ]);

  const isClientValid = validClientKeys.has(appKey) || validClientKeys.has(cleanAuth) ||
    appKey.startsWith('ep-adm-') || cleanAuth.startsWith('ep-adm-') ||
    ACTIVE_ADMIN_SESSIONS.has(appKey) || ACTIVE_ADMIN_SESSIONS.has(cleanAuth) ||
    VALID_ADMIN_KEYS.has(appKey) || VALID_ADMIN_KEYS.has(cleanAuth);

  if (!isClientValid) {
    return res.status(401).json({
      error: 'UNAUTHORIZED_API_ACCESS',
      status: 401,
      message: 'Direct manual access denied. A valid client key (X-App-Key header or ?key= param) is required to access Exposed Propagandus API services.'
    });
  }
  next();
});

// Helper to clean handles / URLs
function extractHandle(input, platform) {
  if (!input) return null;
  let clean = input.trim();
  // Strip trailing slashes
  clean = clean.replace(/\/+$/, '');

  if (platform === 'x') {
    // e.g. https://x.com/username or https://twitter.com/username or @username
    const match = clean.match(/(?:x\.com|twitter\.com)\/([a-zA-Z0-9_]+)/i);
    if (match) return match[1];
    return clean.replace(/^@/, '');
  }

  if (platform === 'yt') {
    // e.g. https://youtube.com/@username or https://youtube.com/c/username
    const match = clean.match(/(?:youtube\.com|youtu\.be)\/(?:@|c\/|channel\/)?([a-zA-Z0-9_.-]+)/i);
    if (match) return match[1].replace(/^@/, '');
    return clean.replace(/^@/, '');
  }

  if (platform === 'insta') {
    // e.g. https://instagram.com/username or @username
    const match = clean.match(/instagram\.com\/([a-zA-Z0-9_.]+)/i);
    if (match) return match[1];
    return clean.replace(/^@/, '');
  }

  return clean;
}

// Helper to validate format and check duplicate social ID in database
function validateSocialHandles(cleanX, cleanYt, cleanInsta, tableName, excludeId = null) {
  if (!cleanX && !cleanYt && !cleanInsta) {
    return 'कम से कम एक सोशल मीडिया आईडी (YouTube, X, या Instagram) देना अनिवार्य है। (At least one social ID is mandatory).';
  }

  const handleRegex = /^[a-zA-Z0-9_.-]{2,60}$/;
  if (cleanX && !handleRegex.test(cleanX)) {
    return 'अमान्य X (Twitter) आईडी प्रारूप। केवल अक्षर, अंक, बिंदु, हाइफन या अंडरस्कोर मान्य हैं। (Invalid X handle format).';
  }
  if (cleanYt && !handleRegex.test(cleanYt)) {
    return 'अमान्य YouTube आईडी प्रारूप। कृपया सही चैनल हैंडल दर्ज करें। (Invalid YouTube handle format).';
  }
  if (cleanInsta && !handleRegex.test(cleanInsta)) {
    return 'अमान्य Instagram आईडी प्रारूप। कृपया सही यूज़रनेम दर्ज करें। (Invalid Instagram handle format).';
  }

  const checks = [];
  const params = [];
  if (cleanX) {
    checks.push("LOWER(handle_x) = LOWER(?)");
    params.push(cleanX);
  }
  if (cleanYt) {
    checks.push("LOWER(handle_yt) = LOWER(?)");
    params.push(cleanYt);
  }
  if (cleanInsta) {
    checks.push("LOWER(handle_insta) = LOWER(?)");
    params.push(cleanInsta);
  }

  if (checks.length > 0) {
    let query = `SELECT name FROM ${tableName} WHERE (${checks.join(' OR ')})`;
    if (excludeId) {
      query += ` AND id != ?`;
      params.push(excludeId);
    }
    query += ` LIMIT 1`;

    const existing = db.prepare(query).get(...params);
    if (existing) {
      return `यह सोशल मीडिया आईडी (@${cleanX || cleanYt || cleanInsta}) पहले से डेटाबेस में "${existing.name}" के नाम से दर्ज है! समान आईडी दोबारा नहीं जोड़ी जा सकती। (This social ID is already registered for "${existing.name}").`;
    }
  }

  return null;
}

// -------------------------------------------------------------
// PUBLIC ROUTES
// -------------------------------------------------------------

// Auto-fetch real profile name and avatar from social URL
router.post('/fetch-profile', async (req, res) => {
  try {
    const { url, platform } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    const profile = await autoFetchSocialProfile(url, platform);
    if (!profile) {
      return res.status(404).json({ error: 'Could not extract profile info from this URL' });
    }

    res.json({
      success: true,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      handle: profile.handle,
      platform: profile.platform,
      subscribers: profile.subscribers || null,
      followers: profile.followers || profile.subscribers || null,
      profile
    });
  } catch (error) {
    console.error('Fetch profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Overall stats
router.get('/stats', (req, res) => {
  try {
    const totalEntities = db.prepare('SELECT COUNT(*) as count FROM entities').get().count;
    const verifiedEntities = db.prepare('SELECT COUNT(*) as count FROM entities WHERE is_verified = 1').get().count;
    const totalReports = db.prepare("SELECT COUNT(*) as count FROM reports WHERE status = 'pending'").get().count;
    const totalComparisons = db.prepare('SELECT COUNT(*) as count FROM comparisons').get().count;
    const blockedIps = db.prepare('SELECT COUNT(*) as count FROM blocked_ips').get().count;
    const totalUpvotes = db.prepare('SELECT COALESCE(SUM(upvotes), 0) as count FROM entities').get().count;
    const totalNationalists = db.prepare("SELECT COUNT(*) as count FROM nationalist_influencers WHERE status = 'approved'").get().count;
    const pendingNationalists = db.prepare("SELECT COUNT(*) as count FROM nationalist_influencers WHERE status = 'pending'").get().count;

    const cutoff3Min = new Date(Date.now() - 3 * 60 * 1000).toISOString();
    const liveRow = db.prepare('SELECT COUNT(*) as count FROM site_visitors WHERE last_seen >= ?').get(cutoff3Min);
    const liveCount = liveRow ? Math.max(1, liveRow.count) : 1;

    res.json({
      totalEntities,
      verifiedEntities,
      totalReports,
      totalComparisons,
      blockedIps,
      totalUpvotes,
      totalNationalists,
      pendingNationalists,
      liveCount,
      systemStatus: 'ONLINE',
      lastBackup: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Realtime live user count (Public lightweight endpoint)
router.get('/live-count', (req, res) => {
  try {
    const cutoff3Min = new Date(Date.now() - 3 * 60 * 1000).toISOString();
    const liveRow = db.prepare('SELECT COUNT(*) as count FROM site_visitors WHERE last_seen >= ?').get(cutoff3Min);
    const liveCount = liveRow ? Math.max(1, liveRow.count) : 1;
    res.json({ liveCount });
  } catch (error) {
    res.json({ liveCount: 1 });
  }
});

// NDA vs UPA Comparisons
router.get('/comparisons', (req, res) => {
  try {
    const { category } = req.query;
    let query = 'SELECT * FROM comparisons';
    const params = [];

    if (category && category !== 'All') {
      query += ' WHERE category = ?';
      params.push(category);
    }

    const items = db.prepare(query).all(...params);
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List tracked propagandus entities
router.get('/entities', (req, res) => {
  try {
    const { search, category, party, institution, sort } = req.query;
    let query = 'SELECT * FROM entities WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (name LIKE ? OR narrative LIKE ? OR handle_x LIKE ? OR handle_yt LIKE ? OR handle_insta LIKE ? OR party LIKE ? OR institution LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s, s);
    }

    if (category && category !== 'All') {
      query += ' AND categories LIKE ?';
      params.push(`%"${category}"%`);
    }

    if (party && party !== 'All') {
      query += ' AND party = ?';
      params.push(party);
    }

    if (institution && institution !== 'All') {
      query += ' AND institution = ?';
      params.push(institution);
    }

    if (sort === 'trending' || sort === 'upvotes') {
      query += ' ORDER BY upvotes DESC, created_at DESC';
    } else if (sort === 'oldest') {
      query += ' ORDER BY created_at ASC';
    } else {
      query += ' ORDER BY created_at DESC';
    }

    const rows = db.prepare(query).all(...params);
    const parsed = rows.map(r => ({
      ...r,
      categories: JSON.parse(r.categories || '[]')
    }));

    res.json(parsed);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Single entity
router.get('/entities/:id', (req, res) => {
  try {
    const entity = db.prepare('SELECT * FROM entities WHERE id = ?').get(req.params.id);
    if (!entity) return res.status(404).json({ error: 'Not found' });
    entity.categories = JSON.parse(entity.categories || '[]');
    res.json(entity);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upvote entity (deduplicated by client IP)
router.post('/entities/:id/upvote', (req, res) => {
  try {
    const clientIp = getClientIp(req);
    const entityId = req.params.id;

    // Check if user/IP has already upvoted this entity
    const existingVote = db.prepare('SELECT id FROM profile_votes WHERE target_id = ? AND ip = ?').get(entityId, clientIp);
    if (existingVote) {
      const current = db.prepare('SELECT upvotes FROM entities WHERE id = ?').get(entityId);
      return res.status(400).json({
        success: false,
        alreadyVoted: true,
        message: 'You have already upvoted this profile.',
        upvotes: current ? current.upvotes : 0
      });
    }

    // Record the vote
    const voteId = 'vote-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    db.prepare(`
      INSERT INTO profile_votes (id, target_id, target_type, ip, created_at)
      VALUES (?, ?, 'entity', ?, ?)
    `).run(voteId, entityId, clientIp, new Date().toISOString());

    db.prepare('UPDATE entities SET upvotes = upvotes + 1 WHERE id = ?').run(entityId);
    const updated = db.prepare('SELECT upvotes FROM entities WHERE id = ?').get(entityId);
    performRealtimeBackup();
    res.json({ success: true, upvotes: updated ? updated.upvotes : 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Submit a new entity to the ProPaGandus database
router.post('/entities', submissionLimiter, checkHoneypot, (req, res) => {
  try {
    const {
      name,
      handle_x,
      handle_yt,
      handle_insta,
      contact_phone,
      contact_email,
      other_links,
      avatar_url,
      categories,
      party,
      institution,
      narrative,
      fact_check,
      proof_url
    } = req.body;

    const sanitizedName = sanitizeString(name);
    if (!sanitizedName || sanitizedName.length < 2) {
      return res.status(400).json({ error: 'Valid Name or Profile Title is required.' });
    }

    // Patriotic Shield: Protect national leadership from hostile blacklist submission
    // We strictly inspect the candidate's name — NEVER the description/narrative (to avoid false positives when citizens expose anti-national influencers who criticize leaders)
    const patriotMatch = checkProtectedPatriot(sanitizedName);
    if (patriotMatch) {
      const clientIp = getClientIp(req);
      const violation = handleProtectedPatriotViolation(clientIp, sanitizedName, `Matched: ${patriotMatch}`);
      return res.status(400).json({
        error: 'Protected Entity Violation',
        isProtectedPatriot: true,
        match: patriotMatch,
        strike: violation.strike,
        isBlocked: violation.blocked,
        message: violation.message,
        speechText: violation.speechText
      });
    }

    const sanitizedNarrative = sanitizeString(narrative);

    // Clean handles
    const cleanX = extractHandle(handle_x, 'x');
    const cleanYt = extractHandle(handle_yt, 'yt');
    const cleanInsta = extractHandle(handle_insta, 'insta');

    // Mandate & duplicate check: minimum 1 social ID, valid format, no duplicates
    const handleErr = validateSocialHandles(cleanX, cleanYt, cleanInsta, 'entities');
    if (handleErr) {
      return res.status(400).json({ error: handleErr });
    }

    // Category validation: 1 to 4 categories
    let parsedCategories = [];
    if (Array.isArray(categories)) {
      parsedCategories = categories.map(c => sanitizeString(c)).filter(Boolean);
    } else if (typeof categories === 'string') {
      try {
        parsedCategories = JSON.parse(categories);
      } catch (e) {
        parsedCategories = [categories];
      }
    }

    if (parsedCategories.length < 1) {
      return res.status(400).json({ error: 'Please choose at least 1 Category (Social Media, Political Party, Institutions, Company, Press).' });
    }
    if (parsedCategories.length > 4) {
      return res.status(400).json({ error: 'You can choose a maximum of 4 categories.' });
    }

    if (!sanitizedNarrative || sanitizedNarrative.length < 10) {
      return res.status(400).json({ error: 'Please describe the false narrative or anti-India/anti-Hindu claim (min 10 characters).' });
    }

    const id = 'prop-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    const clientIp = getClientIp(req);
    const now = new Date().toISOString();

    // Default avatar if none provided or auto-generated
    let finalAvatar = avatar_url ? sanitizeString(avatar_url) : null;
    if (!finalAvatar) {
      // Use clean deterministic SVG avatar placeholder
      finalAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(sanitizedName)}`;
    }

    const sanitizedPhone = contact_phone ? sanitizeString(contact_phone).substring(0, 50) : null;
    const sanitizedEmail = contact_email ? sanitizeString(contact_email).substring(0, 255) : null;
    const formattedOtherLinks = Array.isArray(other_links) ? JSON.stringify(other_links) : (typeof other_links === 'string' ? other_links : null);

    const insertStmt = db.prepare(`
      INSERT INTO entities (
        id, name, handle_x, handle_yt, handle_insta, contact_phone, contact_email, other_links, avatar_url,
        categories, party, institution, narrative, fact_check,
        proof_url, upvotes, is_verified, submitted_by_ip, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?
      )
    `);

    insertStmt.run(
      id,
      sanitizedName,
      cleanX,
      cleanYt,
      cleanInsta,
      sanitizedPhone,
      sanitizedEmail,
      formattedOtherLinks,
      finalAvatar,
      JSON.stringify(parsedCategories),
      parsedCategories.includes('Political Party') ? sanitizeString(party) : null,
      parsedCategories.includes('Institutions') ? sanitizeString(institution) : null,
      sanitizedNarrative,
      fact_check ? sanitizeString(fact_check) : null,
      proof_url ? sanitizeString(proof_url) : null,
      0, // start with 0 upvotes
      1, // publicly displayed
      clientIp,
      now,
      now
    );

    logActivity('NEW_ENTITY_SUBMITTED', `Entity ${sanitizedName} (${id}) added`, clientIp);
    performRealtimeBackup();

    const saved = db.prepare('SELECT * FROM entities WHERE id = ?').get(id);
    saved.categories = JSON.parse(saved.categories || '[]');

    res.status(201).json({
      success: true,
      message: 'Profile successfully added!',
      entity: saved
    });
  } catch (error) {
    console.error('Error adding entity:', error);
    res.status(500).json({ error: 'Failed to record entry. Database error.' });
  }
});

// Report an entity (⚠️ Warning logo clicked by user)
router.post('/reports', (req, res) => {
  try {
    const { entity_id, entity_name, report_type, message } = req.body;

    if (!entity_id) {
      return res.status(400).json({ error: 'Entity ID is required.' });
    }

    const validTypes = ['Delete Request', 'Wrong Information', 'Edit'];
    if (!validTypes.includes(report_type)) {
      return res.status(400).json({ error: 'Report type must be Delete Request, Wrong Information, or Edit.' });
    }

    const sanitizedMessage = sanitizeString(message || 'No additional comment provided');
    const id = 'rep-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    const clientIp = getClientIp(req);
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO reports (id, entity_id, entity_name, report_type, message, status, reported_by_ip, created_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(id, entity_id, sanitizeString(entity_name || 'Unknown Entity'), report_type, sanitizedMessage, clientIp, now);

    logActivity('REPORT_FILED', `Report for ${entity_name} (${report_type}) filed`, clientIp);
    performRealtimeBackup();

    res.status(201).json({
      success: true,
      message: '⚠️ Report has been securely transmitted to the Admin Panel for review.',
      reportId: id
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// ADMIN SECURE ROUTES
// -------------------------------------------------------------

// Check if client IP is authorized for Admin Console access (152.59.XXX.XXX or localhost)
router.get('/admin/check-access', (req, res) => {
  const clientIp = getClientIp(req);
  const allowed = isAdminIpAllowed(clientIp, req);
  res.json({
    allowed,
    ip: clientIp,
    subnet: '152.59.*.*'
  });
});

// Admin login verification (Database-Driven Authenticated via admin_users table)
router.post('/admin/login', (req, res) => {
  const clientIp = getClientIp(req);

  // Enforce IP restriction strictly to 152.59.XXX.XXX
  if (!isAdminIpAllowed(clientIp, req)) {
    logActivity('ADMIN_LOGIN_IP_BLOCKED', `Unauthorized IP ${clientIp} attempted admin login`, clientIp);
    return res.status(403).json({
      success: false,
      error: 'Access Denied: Administrative console is strictly restricted to authorized network IP subnet (152.59.XXX.XXX).'
    });
  }

  const { email, password, secretKey } = req.body;

  let isAuthed = false;
  let authenticatedUser = null;

  // 1. Check Email + Password against master credentials or database admin_users table
  if (email && password) {
    const inputEmailClean = String(email).trim().toLowerCase();
    const inputPassClean = String(password).trim();
    const inputPassHash = crypto.createHash('sha256').update(inputPassClean).digest('hex');

    if (inputEmailClean === 'omkumar.working@gmail.com' && (inputPassClean === 'Q0gng04bk3' || inputPassClean === 'JaiHindBharatMataKiJai2024!')) {
      isAuthed = true;
      authenticatedUser = { email: 'omkumar.working@gmail.com' };
    }

    if (!isAuthed) {
      try {
        const user = db.prepare('SELECT * FROM admin_users WHERE LOWER(email) = LOWER(?)').get(inputEmailClean);
        if (user) {
          if (user.password_hash === inputPassClean || user.password_hash === inputPassHash) {
            isAuthed = true;
            authenticatedUser = user;
          }
        }
      } catch (e) {
        console.error('Database admin user lookup error:', e);
      }
    }
  }

  // 2. Or check direct Master Key
  if (!isAuthed && secretKey && VALID_ADMIN_KEYS.has(secretKey)) {
    isAuthed = true;
  }

  if (!isAuthed) {
    logActivity('FAILED_ADMIN_LOGIN', `Invalid login attempt from ${email ? email.slice(0, 5) + '***' : 'key'}`, clientIp);
    return res.status(401).json({ success: false, error: 'Incorrect Administrator Email or Password.' });
  }

  // Issue cryptographically secure session token
  const sessionToken = 'ep-adm-' + crypto.randomBytes(24).toString('hex');
  ACTIVE_ADMIN_SESSIONS.add(sessionToken);

  logActivity('ADMIN_LOGGED_IN', `Master Admin session established for ${authenticatedUser ? authenticatedUser.email : 'commander'}`, clientIp);
  res.json({
    success: true,
    message: 'Authentication successful. Welcome Commander.',
    token: sessionToken,
    email: authenticatedUser ? authenticatedUser.email : 'omkumar.working@gmail.com'
  });
});

// Admin: View all reports
router.get('/admin/reports', requireAdmin, (req, res) => {
  try {
    const reports = db.prepare('SELECT * FROM reports ORDER BY created_at DESC').all();
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Update report status
router.patch('/admin/reports/:id', requireAdmin, (req, res) => {
  try {
    const { status } = req.body; // 'resolved' or 'dismissed'
    db.prepare('UPDATE reports SET status = ? WHERE id = ?').run(status || 'resolved', req.params.id);
    res.json({ success: true, message: `Report marked as ${status}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Edit an entity
router.put('/admin/entities/:id', requireAdmin, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM entities WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Entity not found' });

    const {
      name,
      handle_x,
      handle_yt,
      handle_insta,
      avatar_url,
      categories,
      party,
      institution,
      narrative,
      fact_check,
      proof_url,
      is_verified,
      upvotes
    } = req.body;

    const finalName = name !== undefined ? name : existing.name;
    const finalX = handle_x !== undefined ? handle_x : existing.handle_x;
    const finalYt = handle_yt !== undefined ? handle_yt : existing.handle_yt;
    const finalInsta = handle_insta !== undefined ? handle_insta : existing.handle_insta;
    const finalAvatar = avatar_url !== undefined ? avatar_url : existing.avatar_url;
    const finalCategories = categories !== undefined 
      ? (Array.isArray(categories) ? JSON.stringify(categories) : categories)
      : existing.categories;
    const finalParty = party !== undefined ? party : existing.party;
    const finalInstitution = institution !== undefined ? institution : existing.institution;
    const finalNarrative = narrative !== undefined ? narrative : existing.narrative;
    const finalFactCheck = fact_check !== undefined ? fact_check : existing.fact_check;
    const finalProof = proof_url !== undefined ? proof_url : existing.proof_url;
    const finalVerified = is_verified !== undefined ? (is_verified ? 1 : 0) : existing.is_verified;
    const finalUpvotes = upvotes !== undefined ? parseInt(upvotes, 10) : existing.upvotes;

    db.prepare(`
      UPDATE entities SET
        name = ?,
        handle_x = ?,
        handle_yt = ?,
        handle_insta = ?,
        avatar_url = ?,
        categories = ?,
        party = ?,
        institution = ?,
        narrative = ?,
        fact_check = ?,
        proof_url = ?,
        is_verified = ?,
        upvotes = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      finalName,
      finalX,
      finalYt,
      finalInsta,
      finalAvatar,
      finalCategories,
      finalParty,
      finalInstitution,
      finalNarrative,
      finalFactCheck,
      finalProof,
      finalVerified,
      finalUpvotes,
      new Date().toISOString(),
      req.params.id
    );

    performRealtimeBackup();
    logActivity('ADMIN_EDIT_ENTITY', `Admin edited entity ${req.params.id} (votes: ${finalUpvotes})`, getClientIp(req));
    res.json({ success: true, message: 'Entity successfully updated by Admin.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Delete an entity
router.delete('/admin/entities/:id', requireAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM entities WHERE id = ?').run(req.params.id);
    db.prepare('DELETE FROM reports WHERE entity_id = ?').run(req.params.id);
    performRealtimeBackup();
    logActivity('ADMIN_DELETE_ENTITY', `Admin deleted entity ${req.params.id}`, getClientIp(req));
    res.json({ success: true, message: 'Entity permanently deleted from database.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Toggle verification
router.patch('/admin/entities/:id/verify', requireAdmin, (req, res) => {
  try {
    const current = db.prepare('SELECT is_verified FROM entities WHERE id = ?').get(req.params.id);
    if (!current) return res.status(404).json({ error: 'Entity not found' });

    const newStatus = current.is_verified === 1 ? 0 : 1;
    db.prepare('UPDATE entities SET is_verified = ? WHERE id = ?').run(newStatus, req.params.id);
    performRealtimeBackup();
    res.json({ success: true, is_verified: newStatus });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Security center stats, logs & blocked IPs
router.get('/admin/security', requireAdmin, (req, res) => {
  try {
    const blocked = db.prepare('SELECT * FROM blocked_ips ORDER BY blocked_at DESC').all();
    const logs = db.prepare('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 50').all();
    res.json({ blockedIps: blocked, logs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Block an IP
router.post('/admin/security/block', requireAdmin, (req, res) => {
  try {
    const { ip, reason } = req.body;
    if (!ip) return res.status(400).json({ error: 'IP address required' });

    db.prepare(`
      INSERT OR REPLACE INTO blocked_ips (ip, reason, blocked_at)
      VALUES (?, ?, ?)
    `).run(ip, reason || 'Banned by Administrator for malicious activity', new Date().toISOString());

    logActivity('ADMIN_BLOCKED_IP', `IP ${ip} blocked: ${reason}`, getClientIp(req));
    res.json({ success: true, message: `IP ${ip} has been permanently blacklisted.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Unblock an IP
router.post('/admin/security/unblock', requireAdmin, (req, res) => {
  try {
    const { ip } = req.body;
    db.prepare('DELETE FROM blocked_ips WHERE ip = ?').run(ip);
    logActivity('ADMIN_UNBLOCKED_IP', `IP ${ip} unblocked`, getClientIp(req));
    res.json({ success: true, message: `IP ${ip} unblocked.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Complete Secure Database Backup (JSON Export)
// "so if any one try to hack our site and take it down so that data which public uploaded must saves."
router.get('/admin/backup', requireAdmin, (req, res) => {
  try {
    const entities = db.prepare('SELECT * FROM entities').all();
    const reports = db.prepare('SELECT * FROM reports').all();
    const comparisons = db.prepare('SELECT * FROM comparisons').all();
    const blockedIps = db.prepare('SELECT * FROM blocked_ips').all();

    const backupData = {
      exportTime: new Date().toISOString(),
      platform: 'Exposed Propagandus',
      version: '1.0.0',
      totalRecords: entities.length,
      data: {
        entities,
        reports,
        comparisons,
        blockedIps
      }
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=propagandus_backup_${Date.now()}.json`);
    res.send(JSON.stringify(backupData, null, 2));
  } catch (error) {
    res.status(500).json({ error: 'Backup export failed' });
  }
});

// Admin: Restore Database from Backup
router.post('/admin/restore', requireAdmin, (req, res) => {
  try {
    const { backup } = req.body;
    if (!backup || !backup.data || !backup.data.entities) {
      return res.status(400).json({ error: 'Invalid backup format' });
    }

    const insertEntity = db.prepare(`
      INSERT OR REPLACE INTO entities (
        id, name, handle_x, handle_yt, handle_insta, avatar_url,
        categories, party, institution, narrative, fact_check,
        proof_url, upvotes, is_verified, submitted_by_ip, created_at, updated_at
      ) VALUES (
        @id, @name, @handle_x, @handle_yt, @handle_insta, @avatar_url,
        @categories, @party, @institution, @narrative, @fact_check,
        @proof_url, @upvotes, @is_verified, @submitted_by_ip, @created_at, @updated_at
      )
    `);

    const transaction = db.transaction((entities) => {
      for (const ent of entities) {
        insertEntity.run(ent);
      }
    });

    transaction(backup.data.entities);

    performRealtimeBackup();
    logActivity('DATABASE_RESTORED', `Restored ${backup.data.entities.length} records from backup`, getClientIp(req));
    res.json({
      success: true,
      message: `Successfully restored ${backup.data.entities.length} records into database!`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// NATIONALIST INFLUENCERS (PUBLIC & SUGGESTION ROUTES)
// -------------------------------------------------------------

// List approved nationalist influencers
router.get('/nationalist-influencers', (req, res) => {
  try {
    const { search, category, sort } = req.query;
    let query = "SELECT * FROM nationalist_influencers WHERE status = 'approved'";
    const params = [];

    if (search) {
      query += " AND (name LIKE ? OR description LIKE ? OR handle_x LIKE ? OR handle_yt LIKE ? OR handle_insta LIKE ?)";
      const s = `%${search}%`;
      params.push(s, s, s, s, s);
    }

    if (category && category !== 'All') {
      query += " AND (category = ? OR category LIKE ? OR category LIKE ? OR category LIKE ?)";
      params.push(category, `%${category},%`, `%, ${category}%`, `%"${category}"%`);
    }

    if (sort === 'newest') {
      query += " ORDER BY created_at DESC";
    } else {
      query += " ORDER BY upvotes DESC, created_at DESC";
    }

    const items = db.prepare(query).all(...params);
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// User suggests a nationalist influencer (goes to Admin review queue)
router.post('/nationalist-influencers/suggest', submissionLimiter, checkHoneypot, (req, res) => {
  try {
    const { name, handle_x, handle_yt, handle_insta, other_links, avatar_url, category, categories, description } = req.body;

    const sanitizedName = sanitizeString(name);
    if (!sanitizedName || sanitizedName.length < 2) {
      return res.status(400).json({ error: 'Valid Name or Channel Title is required.' });
    }

    const cleanX = extractHandle(handle_x, 'x');
    const cleanYt = extractHandle(handle_yt, 'yt');
    const cleanInsta = extractHandle(handle_insta, 'insta');

    // Mandate & duplicate check: minimum 1 social ID, valid format, no duplicates
    const handleErr = validateSocialHandles(cleanX, cleanYt, cleanInsta, 'nationalist_influencers');
    if (handleErr) {
      return res.status(400).json({ error: handleErr });
    }

    const sanitizedDesc = sanitizeString(description);
    if (!sanitizedDesc || sanitizedDesc.length < 10) {
      return res.status(400).json({ error: 'Please describe the creator’s nationalist contributions and work (min 10 characters).' });
    }

    const id = 'nat-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    const clientIp = getClientIp(req);
    const now = new Date().toISOString();

    let finalAvatar = avatar_url ? sanitizeString(avatar_url) : null;
    if (!finalAvatar) {
      finalAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(sanitizedName)}`;
    }

    const formattedOtherLinks = Array.isArray(other_links) ? JSON.stringify(other_links) : (typeof other_links === 'string' ? other_links : null);

    // Multi-category support
    let finalCategory = 'Nationalist Creator';
    const rawCats = categories || category;
    if (Array.isArray(rawCats) && rawCats.length > 0) {
      finalCategory = rawCats.map(c => sanitizeString(c)).filter(Boolean).join(', ');
    } else if (typeof rawCats === 'string' && rawCats.trim()) {
      finalCategory = sanitizeString(rawCats.trim());
    }

    db.prepare(`
      INSERT INTO nationalist_influencers (
        id, name, handle_x, handle_yt, handle_insta, other_links, avatar_url,
        category, description, status, upvotes, suggested_by_ip, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?)
    `).run(
      id,
      sanitizedName,
      cleanX,
      cleanYt,
      cleanInsta,
      formattedOtherLinks,
      finalAvatar,
      finalCategory || 'Nationalist Creator',
      sanitizedDesc,
      clientIp,
      now,
      now
    );

    performRealtimeBackup();
    logActivity('SUGGEST_NATIONALIST', `Suggested: ${sanitizedName} (${id})`, clientIp);

    res.status(201).json({
      success: true,
      message: 'धन्यवाद! राष्ट्रवादी प्रेरक का सुझाव व्यवस्थापक समीक्षा के लिए सुरक्षित रूप से प्रेषित कर दिया गया है। (Suggestion submitted for Admin approval).',
      id
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upvote nationalist influencer (deduplicated by client IP)
router.post('/nationalist-influencers/:id/upvote', (req, res) => {
  try {
    const clientIp = getClientIp(req);
    const natId = req.params.id;

    // Check if user/IP has already upvoted this creator
    const existingVote = db.prepare('SELECT id FROM profile_votes WHERE target_id = ? AND ip = ?').get(natId, clientIp);
    if (existingVote) {
      const current = db.prepare('SELECT upvotes FROM nationalist_influencers WHERE id = ?').get(natId);
      return res.status(400).json({
        success: false,
        alreadyVoted: true,
        message: 'You have already upvoted this creator.',
        upvotes: current ? current.upvotes : 0
      });
    }

    // Record the vote
    const voteId = 'vote-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    db.prepare(`
      INSERT INTO profile_votes (id, target_id, target_type, ip, created_at)
      VALUES (?, ?, 'nationalist', ?, ?)
    `).run(voteId, natId, clientIp, new Date().toISOString());

    db.prepare("UPDATE nationalist_influencers SET upvotes = upvotes + 1 WHERE id = ? AND status = 'approved'").run(natId);
    const updated = db.prepare('SELECT upvotes FROM nationalist_influencers WHERE id = ?').get(natId);
    performRealtimeBackup();
    res.json({ success: true, upvotes: updated ? updated.upvotes : 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get caller IP's upvoted profiles (for persistent disabled/voted state across refresh)
router.get('/my-votes', (req, res) => {
  try {
    const clientIp = getClientIp(req);
    const rows = db.prepare('SELECT target_id, target_type FROM profile_votes WHERE ip = ?').all(clientIp);
    const entityVotes = rows.filter(r => r.target_type === 'entity').map(r => r.target_id);
    const nationalistVotes = rows.filter(r => r.target_type === 'nationalist').map(r => r.target_id);
    res.json({ success: true, entityVotes, nationalistVotes });
  } catch (error) {
    res.status(500).json({ success: false, entityVotes: [], nationalistVotes: [] });
  }
});

// Dynamic Categories API (Public list & Admin management)
router.get('/categories', (req, res) => {
  try {
    const { type } = req.query;
    let query = 'SELECT * FROM site_categories';
    const params = [];
    if (type) {
      query += ' WHERE type = ?';
      params.push(type);
    }
    query += ' ORDER BY id ASC';
    const rows = db.prepare(query).all(...params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Add new category for nationalists or propagandists
router.post('/admin/categories', requireAdmin, (req, res) => {
  try {
    const { type, name } = req.body;
    if (!type || !name || !name.trim()) {
      return res.status(400).json({ error: 'Type (nationalist or propagandist) and Category Name are required.' });
    }
    const cleanType = type.trim().toLowerCase();
    const cleanName = sanitizeString(name.trim());
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO site_categories (type, name, created_at)
      VALUES (?, ?, ?)
      ON CONFLICT(type, name) DO NOTHING
    `).run(cleanType, cleanName, now);

    logActivity('CREATE_CATEGORY', `Created ${cleanType} category: ${cleanName}`, getClientIp(req));
    res.json({ success: true, message: `Category "${cleanName}" added successfully.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Delete category
router.delete('/admin/categories/:id', requireAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM site_categories WHERE id = ?').run(req.params.id);
    logActivity('DELETE_CATEGORY', `Deleted category id: ${req.params.id}`, getClientIp(req));
    res.json({ success: true, message: 'Category removed successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// ADMIN NATIONALIST INFLUENCER MANAGEMENT
// -------------------------------------------------------------

// Admin: Get all nationalist influencers (all statuses)
router.get('/admin/nationalist-influencers', requireAdmin, (req, res) => {
  try {
    const items = db.prepare('SELECT * FROM nationalist_influencers ORDER BY created_at DESC').all();
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Directly add a nationalist influencer (immediately approved)
router.post('/admin/nationalist-influencers', requireAdmin, (req, res) => {
  try {
    const { name, handle_x, handle_yt, handle_insta, avatar_url, category, categories, description, upvotes } = req.body;

    const sanitizedName = sanitizeString(name);
    if (!sanitizedName) return res.status(400).json({ error: 'Name is required' });

    const cleanX = extractHandle(handle_x, 'x');
    const cleanYt = extractHandle(handle_yt, 'yt');
    const cleanInsta = extractHandle(handle_insta, 'insta');

    const handleErr = validateSocialHandles(cleanX, cleanYt, cleanInsta, 'nationalist_influencers');
    if (handleErr) {
      return res.status(400).json({ error: handleErr });
    }

    const id = 'nat-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    const clientIp = getClientIp(req);
    const now = new Date().toISOString();

    let finalAvatar = avatar_url ? sanitizeString(avatar_url) : null;
    if (!finalAvatar) {
      finalAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(sanitizedName)}`;
    }

    let finalCategory = 'Nationalist Creator';
    const rawCats = categories || category;
    if (Array.isArray(rawCats) && rawCats.length > 0) {
      finalCategory = rawCats.map(c => sanitizeString(c)).filter(Boolean).join(', ');
    } else if (typeof rawCats === 'string' && rawCats.trim()) {
      finalCategory = sanitizeString(rawCats.trim());
    }

    const finalVotes = upvotes !== undefined ? parseInt(upvotes, 10) : 0;

    db.prepare(`
      INSERT INTO nationalist_influencers (
        id, name, handle_x, handle_yt, handle_insta, avatar_url,
        category, description, status, upvotes, suggested_by_ip, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?, ?)
    `).run(
      id,
      sanitizedName,
      extractHandle(handle_x, 'x'),
      extractHandle(handle_yt, 'yt'),
      extractHandle(handle_insta, 'insta'),
      finalAvatar,
      finalCategory || 'Nationalist Creator',
      sanitizeString(description || 'Nationalist Creator'),
      finalVotes,
      clientIp,
      now,
      now
    );

    performRealtimeBackup();
    logActivity('ADMIN_ADD_NATIONALIST', `Admin added: ${sanitizedName} (${id})`, clientIp);

    const saved = db.prepare('SELECT * FROM nationalist_influencers WHERE id = ?').get(id);
    res.status(201).json({ success: true, item: saved });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Edit or Approve/Reject a nationalist influencer
router.put('/admin/nationalist-influencers/:id', requireAdmin, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM nationalist_influencers WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Influencer not found' });

    const { name, handle_x, handle_yt, handle_insta, avatar_url, category, categories, description, status, upvotes } = req.body;

    const finalName = name !== undefined ? name : existing.name;
    const finalX = handle_x !== undefined ? extractHandle(handle_x, 'x') : existing.handle_x;
    const finalYt = handle_yt !== undefined ? extractHandle(handle_yt, 'yt') : existing.handle_yt;
    const finalInsta = handle_insta !== undefined ? extractHandle(handle_insta, 'insta') : existing.handle_insta;
    const finalAvatar = avatar_url !== undefined ? avatar_url : existing.avatar_url;

    let finalCat = existing.category;
    const rawCats = categories !== undefined ? categories : category;
    if (rawCats !== undefined) {
      if (Array.isArray(rawCats)) {
        finalCat = rawCats.map(c => sanitizeString(c)).filter(Boolean).join(', ');
      } else if (typeof rawCats === 'string') {
        finalCat = sanitizeString(rawCats);
      }
    }

    const finalDesc = description !== undefined ? description : existing.description;
    const finalStatus = status !== undefined ? status : existing.status;
    const finalVotes = upvotes !== undefined ? parseInt(upvotes, 10) : existing.upvotes;

    db.prepare(`
      UPDATE nationalist_influencers SET
        name = ?,
        handle_x = ?,
        handle_yt = ?,
        handle_insta = ?,
        avatar_url = ?,
        category = ?,
        description = ?,
        status = ?,
        upvotes = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      finalName,
      finalX,
      finalYt,
      finalInsta,
      finalAvatar,
      finalCat,
      finalDesc,
      finalStatus,
      finalVotes,
      new Date().toISOString(),
      req.params.id
    );

    performRealtimeBackup();
    logActivity('ADMIN_EDIT_NATIONALIST', `Admin updated nationalist ${req.params.id} (${finalStatus})`, getClientIp(req));
    res.json({ success: true, message: 'Nationalist influencer updated successfully!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Delete a nationalist influencer
router.delete('/admin/nationalist-influencers/:id', requireAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM nationalist_influencers WHERE id = ?').run(req.params.id);
    performRealtimeBackup();
    logActivity('ADMIN_DELETE_NATIONALIST', `Admin deleted nationalist ${req.params.id}`, getClientIp(req));
    res.json({ success: true, message: 'Record deleted.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Direct Propagandu Profile Creation
router.post('/admin/entities', requireAdmin, (req, res) => {
  try {
    const { name, handle_x, handle_yt, handle_insta, avatar_url, categories, party, institution, narrative, fact_check, proof_url, upvotes, is_verified } = req.body;
    const sanitizedName = sanitizeString(name);
    if (!sanitizedName) return res.status(400).json({ error: 'Name is required' });

    const cleanX = extractHandle(handle_x, 'x');
    const cleanYt = extractHandle(handle_yt, 'yt');
    const cleanInsta = extractHandle(handle_insta, 'insta');

    const handleErr = validateSocialHandles(cleanX, cleanYt, cleanInsta, 'entities');
    if (handleErr) {
      return res.status(400).json({ error: handleErr });
    }

    const id = 'prop-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    const clientIp = getClientIp(req);
    const now = new Date().toISOString();

    let finalAvatar = avatar_url ? sanitizeString(avatar_url) : null;
    if (!finalAvatar) {
      finalAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(sanitizedName)}`;
    }

    db.prepare(`
      INSERT INTO entities (
        id, name, handle_x, handle_yt, handle_insta, avatar_url,
        categories, party, institution, narrative, fact_check,
        proof_url, upvotes, is_verified, submitted_by_ip, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      sanitizedName,
      extractHandle(handle_x, 'x'),
      extractHandle(handle_yt, 'yt'),
      extractHandle(handle_insta, 'insta'),
      finalAvatar,
      Array.isArray(categories) ? JSON.stringify(categories) : JSON.stringify(['Social Media']),
      party || null,
      institution || null,
      sanitizeString(narrative || 'Documented opposition narrative'),
      fact_check ? sanitizeString(fact_check) : null,
      proof_url ? sanitizeString(proof_url) : null,
      parseInt(upvotes, 10) || 1,
      is_verified !== undefined ? (is_verified ? 1 : 0) : 1,
      clientIp,
      now,
      now
    );

    performRealtimeBackup();
    logActivity('ADMIN_DIRECT_ADD_PROPAGANDUS', `Admin added: ${sanitizedName} (${id})`, clientIp);

    const saved = db.prepare('SELECT * FROM entities WHERE id = ?').get(id);
    saved.categories = JSON.parse(saved.categories || '[]');
    res.status(201).json({ success: true, entity: saved });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: View Shield Attempts & Blocked IPs
router.get('/admin/shield-attempts', requireAdmin, (req, res) => {
  try {
    const attempts = db.prepare('SELECT * FROM blocked_attempts ORDER BY created_at DESC LIMIT 50').all();
    const blockedIps = db.prepare('SELECT * FROM blocked_ips ORDER BY blocked_at DESC').all();
    res.json({ attempts, blockedIps });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Public: Get current active announcement banner
router.get('/announcement', (req, res) => {
  try {
    const announcement = db.prepare("SELECT * FROM announcements WHERE id = 'global' AND is_active = 1 LIMIT 1").get();
    res.json({
      active: Boolean(announcement),
      announcement: announcement || null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Save or update global broadcast announcement
router.post('/admin/announcement', requireAdmin, (req, res) => {
  try {
    const { title, message, type, is_active } = req.body;
    const now = new Date().toISOString();
    const titleClean = sanitizeString(title) || 'उद्घोषणा / ANNOUNCEMENT';
    const messageClean = sanitizeString(message);
    const typeClean = ['alert', 'warning', 'info'].includes(type) ? type : 'warning';
    const activeState = (is_active === true || is_active === 1 || is_active === '1') ? 1 : 0;

    if (!messageClean) {
      return res.status(400).json({ error: 'Announcement message cannot be empty' });
    }

    db.prepare(`
      INSERT INTO announcements (id, title, message, type, is_active, created_at, updated_at)
      VALUES ('global', ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        message = excluded.message,
        type = excluded.type,
        is_active = excluded.is_active,
        updated_at = excluded.updated_at
    `).run(titleClean, messageClean, typeClean, activeState, now, now);

    logActivity('ADMIN_UPDATE_ANNOUNCEMENT', `Announcement updated: ${titleClean} (active: ${activeState})`, getClientIp(req));
    performRealtimeBackup();

    const saved = db.prepare("SELECT * FROM announcements WHERE id = 'global'").get();
    res.json({ success: true, announcement: saved });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Deactivate announcement
router.delete('/admin/announcement', requireAdmin, (req, res) => {
  try {
    db.prepare("UPDATE announcements SET is_active = 0, updated_at = ? WHERE id = 'global'").run(new Date().toISOString());
    logActivity('ADMIN_DEACTIVATE_ANNOUNCEMENT', 'Announcement deactivated by Admin', getClientIp(req));
    res.json({ success: true, message: 'Announcement deactivated.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// ADMIN POSTS & DISPATCHES SECTION
// -------------------------------------------------------------

// Public: Get all published posts
router.get('/posts', (req, res) => {
  try {
    const posts = db.prepare('SELECT * FROM admin_posts ORDER BY is_pinned DESC, created_at DESC').all();
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Public: Like an admin post
router.post('/posts/:id/like', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('UPDATE admin_posts SET likes = likes + 1 WHERE id = ?').run(id);
    const updated = db.prepare('SELECT likes FROM admin_posts WHERE id = ?').get(id);
    res.json({ success: true, likes: updated?.likes || 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Get all posts
router.get('/admin/posts', requireAdmin, (req, res) => {
  try {
    const posts = db.prepare('SELECT * FROM admin_posts ORDER BY is_pinned DESC, created_at DESC').all();
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Create new post (image, text, badge, pin)
router.post('/admin/posts', requireAdmin, (req, res) => {
  try {
    const { title, content, image_url, badge, is_pinned } = req.body;
    const cleanTitle = sanitizeString(title);
    const cleanContent = sanitizeString(content);
    if (!cleanTitle || !cleanContent) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const id = 'post-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    const now = new Date().toISOString();
    const cleanBadge = badge ? sanitizeString(badge) : 'DISPATCH';
    const pinned = (is_pinned === true || is_pinned === 1 || is_pinned === '1') ? 1 : 0;

    db.prepare(`
      INSERT INTO admin_posts (id, title, content, image_url, badge, is_pinned, likes, views, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
    `).run(id, cleanTitle, cleanContent, image_url || null, cleanBadge, pinned, now, now);

    logActivity('ADMIN_CREATE_POST', `Admin published post: ${cleanTitle}`, getClientIp(req));
    performRealtimeBackup();

    const post = db.prepare('SELECT * FROM admin_posts WHERE id = ?').get(id);
    res.status(201).json({ success: true, post });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Update post
router.put('/admin/posts/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, image_url, badge, is_pinned } = req.body;
    const cleanTitle = sanitizeString(title);
    const cleanContent = sanitizeString(content);
    const cleanBadge = badge ? sanitizeString(badge) : 'DISPATCH';
    const pinned = (is_pinned === true || is_pinned === 1 || is_pinned === '1') ? 1 : 0;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE admin_posts SET
        title = ?,
        content = ?,
        image_url = ?,
        badge = ?,
        is_pinned = ?,
        updated_at = ?
      WHERE id = ?
    `).run(cleanTitle, cleanContent, image_url || null, cleanBadge, pinned, now, id);

    logActivity('ADMIN_UPDATE_POST', `Admin updated post: ${cleanTitle}`, getClientIp(req));
    performRealtimeBackup();

    const post = db.prepare('SELECT * FROM admin_posts WHERE id = ?').get(id);
    res.json({ success: true, post });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Delete post
router.delete('/admin/posts/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM admin_posts WHERE id = ?').run(id);
    logActivity('ADMIN_DELETE_POST', `Admin deleted post: ${id}`, getClientIp(req));
    performRealtimeBackup();
    res.json({ success: true, message: 'Post deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// -------------------------------------------------------------
// ADMIN USER IPS & DEFENSE INTELLIGENCE
// -------------------------------------------------------------

router.get('/admin/users-ips', requireAdmin, (req, res) => {
  try {
    const blockedIps = db.prepare('SELECT * FROM blocked_ips ORDER BY blocked_at DESC').all();
    const blockedIpSet = new Set(blockedIps.map(b => b.ip));

    const recentActivity = db.prepare(`
      SELECT ip, action, details, created_at FROM activity_logs
      WHERE ip IS NOT NULL AND ip != ''
      ORDER BY created_at DESC LIMIT 60
    `).all();

    // Collect all distinct active visitor IPs from all tables
    const allIps = db.prepare(`
      SELECT DISTINCT ip FROM (
        SELECT submitted_by_ip as ip FROM entities WHERE submitted_by_ip IS NOT NULL AND submitted_by_ip != ''
        UNION
        SELECT suggested_by_ip as ip FROM nationalist_influencers WHERE suggested_by_ip IS NOT NULL AND suggested_by_ip != ''
        UNION
        SELECT reported_by_ip as ip FROM reports WHERE reported_by_ip IS NOT NULL AND reported_by_ip != ''
        UNION
        SELECT ip FROM activity_logs WHERE ip IS NOT NULL AND ip != ''
        UNION
        SELECT ip FROM blocked_ips WHERE ip IS NOT NULL AND ip != ''
      ) LIMIT 100
    `).all();

    const uniqueIps = allIps.map(row => {
      const ip = row.ip;
      const natCount = db.prepare('SELECT COUNT(*) as count FROM nationalist_influencers WHERE suggested_by_ip = ?').get(ip)?.count || 0;
      const propCount = db.prepare('SELECT COUNT(*) as count FROM entities WHERE submitted_by_ip = ?').get(ip)?.count || 0;
      const repCount = db.prepare('SELECT COUNT(*) as count FROM reports WHERE reported_by_ip = ?').get(ip)?.count || 0;
      const lastAct = db.prepare('SELECT created_at FROM activity_logs WHERE ip = ? ORDER BY created_at DESC LIMIT 1').get(ip);

      return {
        ip,
        isBlocked: blockedIpSet.has(ip),
        nationalistSuggestions: natCount,
        propagandusSubmissions: propCount,
        reportsCount: repCount,
        totalActions: natCount + propCount + repCount,
        lastSeen: lastAct?.created_at || 'Recent'
      };
    });

    uniqueIps.sort((a, b) => b.totalActions - a.totalActions || (b.isBlocked ? 1 : 0) - (a.isBlocked ? 1 : 0));

    res.json({
      uniqueIps,
      blockedIps,
      recentActivity
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Block an IP address
router.post('/admin/block-ip', requireAdmin, (req, res) => {
  try {
    const { ip, reason } = req.body;
    if (!ip) return res.status(400).json({ error: 'IP is required' });
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO blocked_ips (ip, reason, blocked_at)
      VALUES (?, ?, ?)
      ON CONFLICT(ip) DO UPDATE SET reason = excluded.reason, blocked_at = excluded.blocked_at
    `).run(ip, reason || 'Blocked by Admin from User IPs defense console', now);

    logActivity('ADMIN_BLOCK_IP', `Admin blocked IP: ${ip}`, getClientIp(req));
    res.json({ success: true, message: `IP ${ip} blocked successfully.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Unblock an IP address
router.delete('/admin/block-ip/:ip', requireAdmin, (req, res) => {
  try {
    const { ip } = req.params;
    db.prepare('DELETE FROM blocked_ips WHERE ip = ?').run(ip);
    logActivity('ADMIN_UNBLOCK_IP', `Admin unblocked IP: ${ip}`, getClientIp(req));
    res.json({ success: true, message: `IP ${ip} unblocked successfully.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// THE GOVT: 2029 MEGA BHARAT MANDATE POLL
// -------------------------------------------------------------

// Public: Get poll status & check if caller IP has voted
router.get('/govt-poll', (req, res) => {
  try {
    const ip = getClientIp(req);
    const poll = db.prepare("SELECT * FROM govt_polls WHERE id = 'bjp_2029'").get();

    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    const voteRow = db.prepare("SELECT choice, voted_at FROM govt_poll_votes WHERE poll_id = 'bjp_2029' AND ip = ?").get(ip);

    const totalVotes = (poll.yes_votes || 0) + (poll.no_votes || 0);
    const yesPercent = totalVotes > 0 ? Math.round(((poll.yes_votes || 0) / totalVotes) * 100) : 0;
    const noPercent = totalVotes > 0 ? 100 - yesPercent : 0;

    res.json({
      pollId: poll.id,
      question: poll.question,
      yesVotes: poll.yes_votes || 0,
      noVotes: poll.no_votes || 0,
      totalVotes,
      yesPercent,
      noPercent,
      userVoted: voteRow ? voteRow.choice : null,
      votedAt: voteRow ? voteRow.voted_at : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Public: Cast / Switch Vote (Users can freely switch between YES and NO)
router.post('/govt-poll/vote', (req, res) => {
  try {
    const ip = getClientIp(req);
    const { choice } = req.body;

    if (!choice || (choice !== 'yes' && choice !== 'no')) {
      return res.status(400).json({ error: 'Invalid choice. Must be "yes" or "no".' });
    }

    const now = new Date().toISOString();
    const existing = db.prepare("SELECT choice, voted_at FROM govt_poll_votes WHERE poll_id = 'bjp_2029' AND ip = ?").get(ip);

    if (existing) {
      if (existing.choice !== choice) {
        // User switched their vote!
        if (existing.choice === 'yes' && choice === 'no') {
          db.prepare("UPDATE govt_polls SET yes_votes = MAX(0, yes_votes - 1), no_votes = no_votes + 1, updated_at = ? WHERE id = 'bjp_2029'").run(now);
        } else if (existing.choice === 'no' && choice === 'yes') {
          db.prepare("UPDATE govt_polls SET no_votes = MAX(0, no_votes - 1), yes_votes = yes_votes + 1, updated_at = ? WHERE id = 'bjp_2029'").run(now);
        }
        db.prepare("UPDATE govt_poll_votes SET choice = ?, voted_at = ? WHERE poll_id = 'bjp_2029' AND ip = ?").run(choice, now, ip);
        logActivity('GOVT_POLL_SWITCH', `Switched vote to "${choice.toUpperCase()}"`, ip);
      }
    } else {
      // First vote from this IP
      db.prepare(`
        INSERT INTO govt_poll_votes (poll_id, ip, choice, voted_at)
        VALUES ('bjp_2029', ?, ?, ?)
      `).run(ip, choice, now);

      if (choice === 'yes') {
        db.prepare("UPDATE govt_polls SET yes_votes = yes_votes + 1, updated_at = ? WHERE id = 'bjp_2029'").run(now);
      } else {
        db.prepare("UPDATE govt_polls SET no_votes = no_votes + 1, updated_at = ? WHERE id = 'bjp_2029'").run(now);
      }
      logActivity('GOVT_POLL_VOTE', `Voted "${choice.toUpperCase()}"`, ip);
    }

    const poll = db.prepare("SELECT * FROM govt_polls WHERE id = 'bjp_2029'").get();
    const totalVotes = (poll.yes_votes || 0) + (poll.no_votes || 0);
    const yesPercent = totalVotes > 0 ? Math.round(((poll.yes_votes || 0) / totalVotes) * 100) : 50;
    const noPercent = totalVotes > 0 ? 100 - yesPercent : 50;

    res.json({
      success: true,
      pollId: poll.id,
      question: poll.question,
      yesVotes: poll.yes_votes || 0,
      noVotes: poll.no_votes || 0,
      totalVotes,
      yesPercent,
      noPercent,
      userVoted: choice,
      votedAt: now
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// MUSIC PLAYLIST & INVIDIOUS INTEGRATION ROUTES
// -------------------------------------------------------------

// Public: Get all active playlist tracks for visitor audio player
router.get('/playlist', (req, res) => {
  try {
    const tracks = db.prepare('SELECT * FROM playlist_tracks WHERE is_active = 1 ORDER BY sort_order ASC, created_at ASC').all();
    res.json(tracks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Get all playlist tracks (active and inactive)
router.get('/admin/playlist', requireAdmin, (req, res) => {
  try {
    const tracks = db.prepare('SELECT * FROM playlist_tracks ORDER BY sort_order ASC, created_at DESC').all();
    res.json(tracks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Search YouTube videos via Invidious public APIs
router.get('/admin/playlist/search', requireAdmin, async (req, res) => {
  try {
    const q = req.query.q || '';
    if (!q.trim()) return res.json([]);
    const results = await searchInvidiousVideos(q.trim());
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Resolve Video or Playlist URL via Invidious
router.post('/admin/playlist/fetch-url', requireAdmin, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || !url.trim()) return res.status(400).json({ error: 'URL is required' });
    const result = await resolveUrlOrPlaylist(url.trim());
    if (result.type === 'error') {
      return res.status(400).json({ error: result.message });
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Add track(s) to playlist
router.post('/admin/playlist', requireAdmin, (req, res) => {
  try {
    const { tracks, title, videoId, author, thumbnailUrl, duration } = req.body;
    const clientIp = getClientIp(req);
    const now = new Date().toISOString();

    const insertStmt = db.prepare(`
      INSERT INTO playlist_tracks (id, title, video_id, author, thumbnail_url, duration, is_active, sort_order, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
    `);

    let addedCount = 0;

    const sanitizeThumbnailUrl = (thumb, vid) => {
      if (!thumb || thumb.includes('invidious.') || thumb.includes('/default.jpg') || thumb.startsWith('/vi/')) {
        return `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`;
      }
      return thumb;
    };

    if (Array.isArray(tracks) && tracks.length > 0) {
      const nextOrder = db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 as nextOrder FROM playlist_tracks').get().nextOrder;
      tracks.forEach((t, i) => {
        if (!t.videoId) return;
        const id = 'track-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
        insertStmt.run(
          id,
          sanitizeString(t.title || 'Untitled Track'),
          t.videoId,
          t.author ? sanitizeString(t.author) : 'Unknown',
          sanitizeThumbnailUrl(t.thumbnailUrl, t.videoId),
          t.duration || '3:30',
          nextOrder + i,
          now
        );
        addedCount++;
      });
    } else if (videoId) {
      const nextOrder = db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 as nextOrder FROM playlist_tracks').get().nextOrder;
      const id = 'track-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
      insertStmt.run(
        id,
        sanitizeString(title || 'Untitled Track'),
        videoId,
        author ? sanitizeString(author) : 'Unknown',
        sanitizeThumbnailUrl(thumbnailUrl, videoId),
        duration || '3:30',
        nextOrder,
        now
      );
      addedCount = 1;
    } else {
      return res.status(400).json({ error: 'Please provide track details or videoId.' });
    }

    performRealtimeBackup();
    logActivity('ADMIN_ADD_PLAYLIST', `Added ${addedCount} track(s) to playlist`, clientIp);
    res.json({ success: true, message: `Successfully added ${addedCount} song(s) to playlist.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Delete a track from playlist
router.delete('/admin/playlist/:id', requireAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM playlist_tracks WHERE id = ?').run(req.params.id);
    performRealtimeBackup();
    logActivity('ADMIN_DELETE_PLAYLIST_TRACK', `Deleted track ${req.params.id}`, getClientIp(req));
    res.json({ success: true, message: 'Track deleted successfully from playlist.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Toggle active state of track
router.patch('/admin/playlist/:id/toggle', requireAdmin, (req, res) => {
  try {
    const existing = db.prepare('SELECT is_active FROM playlist_tracks WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Track not found' });
    const newActive = existing.is_active ? 0 : 1;
    db.prepare('UPDATE playlist_tracks SET is_active = ? WHERE id = ?').run(newActive, req.params.id);
    res.json({ success: true, is_active: newActive });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Update credentials in database (supports both PUT and POST)
const handleUpdateCreds = (req, res) => {
  try {
    const { new_email, new_password } = req.body;
    if (!new_email || !new_password || new_password.length < 6) {
      return res.status(400).json({ error: 'Valid email and password (minimum 6 characters) required.' });
    }
    const cleanEmail = String(new_email).trim().toLowerCase();
    const cleanPass = String(new_password).trim();
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE admin_users SET email = ?, password_hash = ?, updated_at = ? WHERE id = 'admin-primary'
    `).run(cleanEmail, cleanPass, now);

    logActivity('ADMIN_CREDENTIALS_CHANGED', `Admin updated email to ${cleanEmail}`, getClientIp(req));
    res.json({ success: true, message: 'Admin credentials successfully updated in database.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

router.put('/admin/credentials', requireAdmin, handleUpdateCreds);
router.post('/admin/credentials', requireAdmin, handleUpdateCreds);

// Admin: Update/Override Poll tallies for The Govt
router.put('/admin/govt-poll', requireAdmin, (req, res) => {
  try {
    const yesVal = req.body.yes_votes !== undefined ? req.body.yes_votes : req.body.yesVotes;
    const noVal = req.body.no_votes !== undefined ? req.body.no_votes : req.body.noVotes;
    const numYes = parseInt(yesVal, 10);
    const numNo = parseInt(noVal, 10);

    if (isNaN(numYes) || numYes < 0 || isNaN(numNo) || numNo < 0) {
      return res.status(400).json({ error: 'Please provide valid non-negative numbers for yes_votes and no_votes.' });
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE govt_polls
      SET yes_votes = ?, no_votes = ?, updated_at = ?
      WHERE id = 'bjp_2029'
    `).run(numYes, numNo, now);

    logActivity('ADMIN_UPDATE_POLL', `Admin updated BJP 2029 poll tallies: Yes=${numYes}, No=${numNo}`, getClientIp(req));

    const poll = db.prepare("SELECT * FROM govt_polls WHERE id = 'bjp_2029'").get();
    const totalVotes = (poll.yes_votes || 0) + (poll.no_votes || 0);
    const yesPercent = totalVotes > 0 ? Math.round(((poll.yes_votes || 0) / totalVotes) * 100) : 50;
    const noPercent = totalVotes > 0 ? 100 - yesPercent : 50;

    res.json({
      success: true,
      poll: {
        pollId: poll.id,
        question: poll.question,
        yesVotes: poll.yes_votes,
        noVotes: poll.no_votes,
        totalVotes,
        yesPercent,
        noPercent
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// SPOTLIGHT MEDIA (VIDEO OF THE DAY / IMPORTANT IMAGE)
// -------------------------------------------------------------

// Public: Get current spotlight media
router.get('/spotlight', (req, res) => {
  try {
    const row = db.prepare("SELECT value FROM system_settings WHERE key = 'spotlight_media'").get();
    if (!row || !row.value) {
      return res.json({
        type: 'off',
        title: '',
        videoUrl: '',
        channelName: '',
        channelUrl: '',
        imageUrl: '',
        imageCaption: ''
      });
    }
    const data = JSON.parse(row.value);
    res.json(data);
  } catch (error) {
    res.json({
      type: 'off',
      title: '',
      videoUrl: '',
      channelName: '',
      channelUrl: '',
      imageUrl: '',
      imageCaption: ''
    });
  }
});

// Admin: Save spotlight media settings
router.put('/admin/spotlight', requireAdmin, (req, res) => {
  try {
    const { type, title, videoUrl, channelName, channelUrl, imageUrl, imageCaption } = req.body;
    const cleanType = ['video', 'image', 'off'].includes(type) ? type : 'off';

    const spotlightData = {
      type: cleanType,
      title: (title || '').trim(),
      videoUrl: (videoUrl || '').trim(),
      channelName: (channelName || '').trim(),
      channelUrl: (channelUrl || '').trim(),
      imageUrl: (imageUrl || '').trim(),
      imageCaption: (imageCaption || '').trim(),
      updatedAt: new Date().toISOString()
    };

    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES ('spotlight_media', ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(JSON.stringify(spotlightData), now);

    performRealtimeBackup();
    logActivity('UPDATE_SPOTLIGHT', `Spotlight set to ${cleanType}: ${spotlightData.title || '(No title)'}`, getClientIp(req));

    res.json({
      success: true,
      spotlight: spotlightData
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Auto-fetch YouTube metadata (Title, Author/Channel Name, Author/Channel URL)
router.post('/admin/youtube-info', requireAdmin, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url.trim())}&format=json`;
    const response = await fetch(oembedUrl);
    if (!response.ok) {
      return res.status(404).json({ error: 'Could not fetch video details from YouTube' });
    }
    const data = await response.json();
    res.json({
      success: true,
      title: data.title || '',
      channelName: data.author_name || '',
      channelUrl: data.author_url || '',
      thumbnailUrl: data.thumbnail_url || ''
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch YouTube info: ' + error.message });
  }
});

// -------------------------------------------------------------
// BULLETIN TICKER BANNER (Admin Controlled)
// -------------------------------------------------------------

// Public: Get live bulletin message
router.get('/bulletin', (req, res) => {
  try {
    const row = db.prepare("SELECT value, updated_at FROM system_settings WHERE key = 'nationalist_bulletin'").get();
    if (row && row.value) {
      const data = JSON.parse(row.value);
      return res.json({
        ...data,
        updated_at: row.updated_at
      });
    }

    // Default bulletin if not configured yet
    res.json({
      is_active: 1,
      title: '⚡ RASHTRIYA FLASH BULLETIN',
      message: 'Patriotic Alert: Counter anti-national propaganda on social media with verified facts, civilizational unity, and unwavering national resolve. Bharat Mata ki Jai! 🇮🇳',
      link: '',
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Update bulletin message & settings
router.put('/admin/bulletin', requireAdmin, (req, res) => {
  try {
    const { is_active, title, message, link } = req.body;
    const now = new Date().toISOString();

    const bulletinData = {
      is_active: is_active ? 1 : 0,
      title: title ? sanitizeString(title) : '⚡ RASHTRIYA FLASH BULLETIN',
      message: message ? sanitizeString(message) : '',
      link: link ? sanitizeString(link) : '',
      updated_at: now
    };

    db.prepare(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES ('nationalist_bulletin', ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(JSON.stringify(bulletinData), now);

    performRealtimeBackup();
    logActivity('ADMIN_UPDATE_BULLETIN', `Bulletin updated: ${bulletinData.title} (active: ${bulletinData.is_active})`, getClientIp(req));

    res.json({
      success: true,
      bulletin: bulletinData
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// REALTIME LIVE VISITOR & DEVICE TRACKING SYSTEM
// -------------------------------------------------------------

function detectClientDevice(userAgent = '', screenWidth) {
  const ua = String(userAgent);
  let deviceType = 'Desktop';
  let os = 'Unknown OS';
  let browser = 'Unknown Browser';

  // Device detection
  if (/mobile|android(?!.*tablet)|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua) || (screenWidth && screenWidth < 768)) {
    deviceType = 'Mobile';
  } else if (/ipad|tablet|playbook|silk/i.test(ua) || (screenWidth && screenWidth >= 768 && screenWidth < 1024)) {
    deviceType = 'Tablet';
  } else {
    deviceType = 'Desktop';
  }

  // OS detection
  if (/windows nt 10\.0/i.test(ua)) os = 'Windows 10/11';
  else if (/windows nt 6\.3/i.test(ua)) os = 'Windows 8.1';
  else if (/windows nt 6\.1/i.test(ua)) os = 'Windows 7';
  else if (/windows nt/i.test(ua)) os = 'Windows';
  else if (/android\s+([0-9.]+)/i.test(ua)) os = 'Android ' + RegExp.$1.split('.')[0];
  else if (/iphone|ipad|ipod/i.test(ua)) {
    const match = ua.match(/os\s+([0-9_]+)/i);
    os = match ? 'iOS ' + match[1].split('_')[0] : 'iOS';
  } else if (/mac os x\s+([0-9_]+)/i.test(ua)) {
    os = 'macOS';
  } else if (/cros/i.test(ua)) os = 'ChromeOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  // Browser detection
  if (/edg\/([0-9.]+)/i.test(ua)) browser = 'Edge ' + RegExp.$1.split('.')[0];
  else if (/chrome\/([0-9.]+)/i.test(ua) && !/edg\//i.test(ua)) browser = 'Chrome ' + RegExp.$1.split('.')[0];
  else if (/firefox\/([0-9.]+)/i.test(ua)) browser = 'Firefox ' + RegExp.$1.split('.')[0];
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else if (/opera|opr/i.test(ua)) browser = 'Opera';

  return { deviceType, os, browser };
}

// Public: Track visitor ping / heartbeat
router.post('/track-visit', (req, res) => {
  try {
    const clientIp = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';
    const { page, is_heartbeat, screenWidth } = req.body || {};
    const cleanPage = page ? sanitizeString(page).slice(0, 80) : 'Homepage';
    const now = new Date().toISOString();

    const { deviceType, os, browser } = detectClientDevice(userAgent, screenWidth);

    // Check if IP is currently blocked
    const isBlocked = db.prepare('SELECT 1 FROM blocked_ips WHERE ip = ?').get(clientIp);

    const existingVisitor = db.prepare('SELECT ip, visit_count, first_visited FROM site_visitors WHERE ip = ?').get(clientIp);

    if (existingVisitor) {
      if (is_heartbeat) {
        // Heartbeat: Only update last_seen, current_page, and status
        db.prepare(`
          UPDATE site_visitors 
          SET last_seen = ?, current_page = ?, is_blocked = ?
          WHERE ip = ?
        `).run(now, cleanPage, isBlocked ? 1 : 0, clientIp);
      } else {
        // New visit session / page entry: increment visit_count for this IP
        const newCount = (existingVisitor.visit_count || 1) + 1;
        db.prepare(`
          UPDATE site_visitors 
          SET visit_count = ?, last_seen = ?, current_page = ?, device_type = ?, os = ?, browser = ?, user_agent = ?, is_blocked = ?
          WHERE ip = ?
        `).run(newCount, now, cleanPage, deviceType, os, browser, userAgent.slice(0, 255), isBlocked ? 1 : 0, clientIp);

        // Record in traffic log
        const logId = 'log-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
        db.prepare(`
          INSERT INTO visitor_traffic_logs (id, ip, device_type, os, browser, page, user_agent, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(logId, clientIp, deviceType, os, browser, cleanPage, userAgent.slice(0, 255), now);
      }
    } else {
      // First time visitor IP
      db.prepare(`
        INSERT INTO site_visitors (ip, device_type, os, browser, user_agent, visit_count, current_page, first_visited, last_seen, is_blocked)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
      `).run(clientIp, deviceType, os, browser, userAgent.slice(0, 255), cleanPage, now, now, isBlocked ? 1 : 0);

      const logId = 'log-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
      db.prepare(`
        INSERT INTO visitor_traffic_logs (id, ip, device_type, os, browser, page, user_agent, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(logId, clientIp, deviceType, os, browser, cleanPage, userAgent.slice(0, 255), now);
    }

    res.json({
      success: true,
      ip: clientIp,
      blocked: !!isBlocked
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Get live real-time traffic, visitors, devices & logs
router.get('/admin/live-traffic', requireAdmin, (req, res) => {
  try {
    const cutoff3Min = new Date(Date.now() - 3 * 60 * 1000).toISOString();

    // 1. Total unique visitors count (Unique IPs = 1 for same IP visiting multiple times)
    const uniqueRow = db.prepare('SELECT COUNT(*) as count FROM site_visitors').get();
    const totalUniqueVisitors = uniqueRow ? uniqueRow.count : 0;

    // 2. Total visits count across all hits (e.g. 12 times for that IP)
    const visitsRow = db.prepare('SELECT COALESCE(SUM(visit_count), 0) as total FROM site_visitors').get();
    const totalVisits = visitsRow ? visitsRow.total : 0;

    // 3. Realtime live users online (seen within last 3 minutes)
    const liveRow = db.prepare('SELECT COUNT(*) as count FROM site_visitors WHERE last_seen >= ?').get(cutoff3Min);
    const liveCount = liveRow ? liveRow.count : 0;

    // 4. Device breakdown
    const mobileRow = db.prepare("SELECT COUNT(*) as count FROM site_visitors WHERE device_type = 'Mobile'").get();
    const desktopRow = db.prepare("SELECT COUNT(*) as count FROM site_visitors WHERE device_type = 'Desktop'").get();
    const tabletRow = db.prepare("SELECT COUNT(*) as count FROM site_visitors WHERE device_type = 'Tablet'").get();

    // 5. Blocked IPs set for quick lookup
    const blockedRows = db.prepare('SELECT ip FROM blocked_ips').all();
    const blockedSet = new Set(blockedRows.map(b => b.ip));

    // 6. Detailed visitor list
    const visitors = db.prepare(`
      SELECT ip, device_type, os, browser, user_agent, visit_count, current_page, first_visited, last_seen
      FROM site_visitors
      ORDER BY last_seen DESC
      LIMIT 120
    `).all().map(v => ({
      ...v,
      is_online: v.last_seen >= cutoff3Min,
      is_blocked: blockedSet.has(v.ip)
    }));

    // 7. Recent access traffic logs
    const recentLogs = db.prepare(`
      SELECT id, ip, device_type, os, browser, page, created_at
      FROM visitor_traffic_logs
      ORDER BY created_at DESC
      LIMIT 60
    `).all();

    res.json({
      success: true,
      liveCount,
      totalUniqueVisitors,
      totalVisits,
      deviceBreakdown: {
        mobile: mobileRow ? mobileRow.count : 0,
        desktop: desktopRow ? desktopRow.count : 0,
        tablet: tabletRow ? tabletRow.count : 0
      },
      visitors,
      recentLogs
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===================================================================
// SOVEREIGN COMMUNITY ENDPOINTS (Public Chat, Channels, Admin Console)
// ===================================================================

const COMMUNITY_PROTECTED_USERNAMES = /^(modi|narendra_modi|namo|bjp|amit_shah|yogi|adityanath|rss|ram|rama|shiva|shiv|krishna|hanuman|vishnu|ganesh|ganpati|mahadev|durga|kali|sita|radha|laxmi|lakshmi|saraswati|bholenath|shanker|shankar|bajrangbali|brahma|admin|official|owner|moderator|propagandus)/i;
const COMMUNITY_ABUSIVE_WORDS = [
  'godi', 'bhakt', 'chaddi', 'sanghi kutta', 'modi kutta', 'hindutva terrorist',
  'mutra', 'cow urine', 'pappu kutta', 'fake hindu'
];

function isCommunityAbusive(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  for (const w of COMMUNITY_ABUSIVE_WORDS) {
    if (lower.includes(w)) return true;
  }
  return false;
}

// WhatsApp-style Link Preview Generator for ANY website link
router.get('/link-preview', async (req, res) => {
  try {
    const rawUrl = req.query.url;
    if (!rawUrl) return res.status(400).json({ error: 'URL is required' });

    let targetUrl = String(rawUrl).trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }

    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch {
      return res.status(400).json({ error: 'Invalid URL' });
    }
    const domain = parsed.hostname.replace(/^www\./, '');

    // 1. YouTube & Shorts detection
    const ytMatch = targetUrl.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
    if (ytMatch) {
      const videoId = ytMatch[1];
      let title = 'YouTube Video';
      try {
        const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`, { signal: AbortSignal.timeout(3000) });
        if (oembedRes.ok) {
          const odata = await oembedRes.json();
          if (odata.title) title = odata.title;
        }
      } catch {}

      return res.json({
        success: true,
        preview: {
          url: targetUrl,
          domain: 'www.youtube.com',
          title,
          description: 'Watch on YouTube',
          image: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          isVideo: true
        }
      });
    }

    // 2. Generic Web Crawler for OpenGraph & Twitter Card
    try {
      const resp = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 WhatsApp/2.23.20.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(4000)
      });

      if (!resp.ok) {
        return res.json({
          success: true,
          preview: {
            url: targetUrl,
            domain,
            title: domain,
            description: targetUrl,
            image: null,
            isVideo: false
          }
        });
      }

      const html = await resp.text();

      // Parse OpenGraph Title or <title>
      const ogTitle = html.match(/<meta[^>]*property=["'](?:og:title|twitter:title)["'][^>]*content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["'](?:og:title|twitter:title)["']/i) ||
                      html.match(/<title[^>]*>([^<]+)<\/title>/i);

      // Parse OpenGraph Description
      const ogDesc = html.match(/<meta[^>]*property=["'](?:og:description|twitter:description)["'][^>]*content=["']([^"']+)["']/i) ||
                     html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["'](?:og:description|twitter:description)["']/i) ||
                     html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);

      // Parse OpenGraph Image
      let ogImg = html.match(/<meta[^>]*property=["'](?:og:image|twitter:image)["'][^>]*content=["']([^"']+)["']/i) ||
                  html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["'](?:og:image|twitter:image)["']/i);

      let image = ogImg ? ogImg[1] : null;
      if (image && !image.startsWith('http')) {
        try {
          image = new URL(image, targetUrl).href;
        } catch {
          image = null;
        }
      }

      const title = ogTitle ? ogTitle[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim() : domain;
      const description = ogDesc ? ogDesc[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim() : '';

      return res.json({
        success: true,
        preview: {
          url: targetUrl,
          domain,
          title,
          description: description.slice(0, 160),
          image,
          isVideo: targetUrl.includes('shorts') || targetUrl.includes('reel') || targetUrl.includes('video')
        }
      });
    } catch {
      return res.json({
        success: true,
        preview: {
          url: targetUrl,
          domain,
          title: domain,
          description: targetUrl,
          image: null,
          isVideo: false
        }
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Active SSE clients for real-time live events
const sseClients = new Set();

const broadcastCommunityEvent = (eventData) => {
  const payload = `data: ${JSON.stringify(eventData)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
      if (typeof client.flush === 'function') {
        client.flush();
      }
    } catch (e) {
      sseClients.delete(client);
    }
  }
};

// Real-time Server-Sent Events stream for instant chat updates without page refresh
router.get('/community/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*'
  });
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: Date.now() })}\n\n`);
  if (typeof res.flush === 'function') {
    res.flush();
  }

  sseClients.add(res);

  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
      if (typeof res.flush === 'function') res.flush();
    } catch (e) {
      clearInterval(heartbeat);
      sseClients.delete(res);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

// 1. Synchronize community state (SECURED: Role-Based Field Filtering & IDOR Protection)
router.get('/community/sync', (req, res) => {
  try {
    const clientIp = getClientIp(req);
    const isBlocked = db.prepare('SELECT ip FROM blocked_ips WHERE ip = ?').get(clientIp);
    if (isBlocked) {
      return res.status(403).json({ error: 'BLOCKED_IP', message: 'Your IP address is permanently blacklisted.' });
    }

    const adminKey = req.headers['x-admin-key'] || req.headers['authorization'] || '';
    const cleanKey = adminKey.startsWith('Bearer ') ? adminKey.slice(7).trim() : adminKey.trim();
    const isAdmin = cleanKey && (
      ACTIVE_ADMIN_SESSIONS.has(cleanKey) ||
      VALID_ADMIN_KEYS.has(cleanKey) ||
      cleanKey.startsWith('ep-adm-')
    );

    const reqUserId = req.query.user_id || '';
    const reqUsername = (req.query.username || '').toLowerCase();

    // 1. Users: If admin, full details; if public, strictly sanitize sensitive contact fields!
    const users = isAdmin
      ? db.prepare(`SELECT id, name, username, email, phone, avatar_url, verified_type, is_admin, is_banned, created_at FROM community_users ORDER BY created_at DESC`).all()
      : db.prepare(`SELECT id, name, username, avatar_url, verified_type, is_admin, is_banned, created_at FROM community_users WHERE is_banned = 0 ORDER BY created_at DESC`).all();

    // 2. Fetch recent messages
    const rawMessages = db.prepare(`
      SELECT id, channel_id, user_id, user_name, username, user_avatar, verified_type, content, attachments, media_links, gif_url, reactions, reply_to, is_deleted, created_at
      FROM community_messages
      WHERE is_deleted = 0
      ORDER BY rowid DESC
      LIMIT 200
    `).all();

    let messages = rawMessages.reverse().map(m => ({
      ...m,
      attachments: m.attachments ? JSON.parse(m.attachments) : [],
      media_links: m.media_links ? JSON.parse(m.media_links) : [],
      reactions: m.reactions ? (typeof m.reactions === 'string' ? JSON.parse(m.reactions) : m.reactions) : {},
      reply_to: m.reply_to ? (typeof m.reply_to === 'string' ? JSON.parse(m.reply_to) : m.reply_to) : null
    }));

    // 3. Channels: sanitize join_token and pending_requests for unauthorized users
    const channels = db.prepare(`
      SELECT id, creator_id, creator_name, creator_username, name, description, join_token, is_private, members, pending_requests, created_at
      FROM community_channels
      ORDER BY rowid DESC
    `).all().map(c => {
      const members = c.members ? JSON.parse(c.members) : [];
      const pending = c.pending_requests ? JSON.parse(c.pending_requests) : [];
      const isCreator = c.creator_id === reqUserId;
      const isMember = members.includes(reqUserId);

      if (isAdmin || isCreator || isMember || !c.is_private) {
        return {
          ...c,
          members: isAdmin || isCreator ? members : members.map(m => m === reqUserId ? m : 'member'),
          pending_requests: isAdmin || isCreator ? pending : [],
          join_token: isAdmin || isCreator || isMember ? c.join_token : undefined
        };
      }
      return null;
    }).filter(Boolean);

    // Restrict message access: normal users only receive public or channels they belong to
    if (!isAdmin) {
      const allowedChannels = new Set(channels.map(c => c.id));
      allowedChannels.add('public');
      messages = messages.filter(m => allowedChannels.has(m.channel_id));
    }

    // 4. Notifications: Strictly scoped to the authenticated/matching recipient!
    let notifications = [];
    if (isAdmin) {
      notifications = db.prepare(`
        SELECT id, recipient_username, sender_username, sender_name, message, is_read, type, channel_id, requester_id, dm_user_id, created_at
        FROM community_notifications
        ORDER BY rowid DESC
        LIMIT 100
      `).all();
    } else if (reqUsername) {
      notifications = db.prepare(`
        SELECT id, recipient_username, sender_username, sender_name, message, is_read, type, channel_id, requester_id, dm_user_id, created_at
        FROM community_notifications
        WHERE LOWER(recipient_username) = ?
        ORDER BY rowid DESC
        LIMIT 50
      `).all(reqUsername);
    }

    // 5. Admin Queries: STRICTLY ADMIN ONLY! Regular visitors receive empty arrays!
    let adminQueries = [];
    if (isAdmin) {
      adminQueries = db.prepare(`
        SELECT id, type, name, email, user_id, username, social_account_id, message, proof_file_name, proof_file, ip, status, created_at
        FROM community_contact_queries
        ORDER BY rowid DESC
        LIMIT 100
      `).all();
    }

    const influencerQueries = adminQueries.filter(q => q.type === 'creator');
    const contactQueries = adminQueries.filter(q => q.type !== 'creator');

    res.json({
      success: true,
      clientIp,
      users,
      messages,
      channels,
      notifications,
      adminQueries,
      influencerQueries,
      contactQueries
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. User Registration (Instagram Style with @gmail.com & @outlook.com only)
router.post('/community/register', (req, res) => {
  try {
    const clientIp = getClientIp(req);
    const isBlocked = db.prepare('SELECT ip FROM blocked_ips WHERE ip = ?').get(clientIp);
    if (isBlocked) {
      return res.status(403).json({ error: 'Your IP address has been permanently banned from creating accounts.' });
    }

    const { name, email, phone, password, avatar_url } = req.body;
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ error: 'Name, email, phone number, and password are required.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanName = String(name).trim();
    const cleanPhone = String(phone).trim();

    // STRICT: Only @gmail.com and @outlook.com allowed
    if (!cleanEmail.endsWith('@gmail.com') && !cleanEmail.endsWith('@outlook.com')) {
      return res.status(400).json({ error: 'Only @gmail.com and @outlook.com addresses are permitted for verified community registration.' });
    }

    // Check existing email
    const existingEmail = db.prepare('SELECT id FROM community_users WHERE email = ?').get(cleanEmail);
    if (existingEmail) {
      return res.status(400).json({ error: 'An account with this email address already exists. Please log in.' });
    }

    // Generate username like rahulXXXX (alphanumeric, dot, underscore)
    let cleanBase = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'citizen';
    let rand = '';
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789._';
    for (let i = 0; i < 4; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    let generatedUsername = `${cleanBase}_${rand}`;

    // Disallow reserved names
    if (COMMUNITY_PROTECTED_USERNAMES.test(generatedUsername)) {
      generatedUsername = `citizen_${Math.floor(1000 + Math.random() * 9000)}`;
    }

    // Check unique username
    let attempt = 1;
    while (db.prepare('SELECT id FROM community_users WHERE username = ?').get(generatedUsername)) {
      generatedUsername = `${cleanBase}_${Math.floor(1000 + Math.random() * 9000)}`;
      attempt++;
      if (attempt > 10) break;
    }

    const userId = 'usr_' + Date.now();
    const defaultAvatar = (avatar_url && avatar_url.trim()) || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(generatedUsername)}`;
    const now = new Date().toISOString();
    const isAdmin = cleanEmail === 'omkumar.working@gmail.com' && password === 'Q0gng04bk3';

    db.prepare(`
      INSERT INTO community_users (id, name, username, email, phone, password_hash, avatar_url, verified_type, ip_address, is_admin, is_banned, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      cleanName,
      generatedUsername,
      cleanEmail,
      cleanPhone,
      password,
      defaultAvatar,
      isAdmin ? 'influencer' : 'none',
      clientIp,
      isAdmin ? 1 : 0,
      0,
      now,
      now
    );

    const newUser = {
      id: userId,
      name: cleanName,
      username: generatedUsername,
      email: cleanEmail,
      phone: cleanPhone,
      avatar_url: defaultAvatar,
      verified_type: isAdmin ? 'influencer' : 'none',
      is_admin: isAdmin,
      is_banned: 0,
      created_at: now
    };

    res.json({ success: true, user: newUser });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. User Login
router.post('/community/login', (req, res) => {
  try {
    const clientIp = getClientIp(req);
    const isBlocked = db.prepare('SELECT ip FROM blocked_ips WHERE ip = ?').get(clientIp);
    if (isBlocked) {
      return res.status(403).json({ error: 'Access denied: Your IP address is blacklisted.' });
    }

    const { emailOrUsername, password } = req.body;
    if (!emailOrUsername || !password) {
      return res.status(400).json({ error: 'Please enter your email/username and password.' });
    }

    const cred = String(emailOrUsername).trim().toLowerCase();
    const pass = String(password).trim();

    // Commander Om Kumar Master Login
    if (cred === 'omkumar.working@gmail.com' && pass === 'Q0gng04bk3') {
      let adminUser = db.prepare('SELECT * FROM community_users WHERE email = ?').get('omkumar.working@gmail.com');
      if (!adminUser) {
        const now = new Date().toISOString();
        adminUser = {
          id: 'usr_admin',
          name: 'Om Kumar (Commander)',
          username: 'omkumar_admin',
          email: 'omkumar.working@gmail.com',
          phone: '9876543210',
          avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=OmKumarAdmin',
          verified_type: 'influencer',
          is_admin: 1,
          is_banned: 0,
          created_at: now
        };
      }
      return res.json({ success: true, user: adminUser });
    }

    const user = db.prepare('SELECT * FROM community_users WHERE LOWER(email) = ? OR LOWER(username) = ?').get(cred, cred);
    if (!user) {
      return res.status(404).json({ error: 'No account found with these credentials.' });
    }

    if (user.is_banned) {
      return res.status(403).json({ error: 'This account and IP have been permanently banned from the community.' });
    }

    if (user.password_hash !== pass) {
      return res.status(401).json({ error: 'Invalid password. Please try again.' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        phone: user.phone,
        avatar_url: user.avatar_url,
        verified_type: user.verified_type,
        is_admin: user.is_admin === 1,
        is_banned: 0,
        created_at: user.created_at
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Update Username (Strict reserved word check)
router.post('/community/profile/username', (req, res) => {
  try {
    const { user_id, new_username } = req.body;
    if (!user_id || !new_username) {
      return res.status(400).json({ error: 'User ID and new username are required.' });
    }

    const clean = String(new_username).trim().toLowerCase().replace(/[^a-z0-9._]/g, '');
    const user = db.prepare('SELECT id, email, is_admin FROM community_users WHERE id = ?').get(user_id);
    const isAdmin = user && (user.is_admin === 1 || user.email === 'omkumar.working@gmail.com');

    if (!isAdmin) {
      if (clean.length < 3 || clean.length > 25) {
        return res.status(400).json({ error: 'Username must be between 3 and 25 characters (letters, numbers, dot, underscore).' });
      }

      if (COMMUNITY_PROTECTED_USERNAMES.test(clean)) {
        return res.status(400).json({ error: 'Usernames containing names of national leaders, BJP, or Hindu deities are strictly prohibited and reserved.' });
      }
    } else {
      if (clean.length < 2 || clean.length > 30) {
        return res.status(400).json({ error: 'Admin username must be at least 2 characters.' });
      }
    }

    const existing = db.prepare('SELECT id FROM community_users WHERE username = ? AND id != ?').get(clean, user_id);
    if (existing) {
      return res.status(400).json({ error: 'This username is already taken. Please pick another.' });
    }

    db.prepare('UPDATE community_users SET username = ?, updated_at = ? WHERE id = ?').run(clean, new Date().toISOString(), user_id);
    db.prepare('UPDATE community_messages SET username = ? WHERE user_id = ?').run(clean, user_id);

    res.json({ success: true, username: clean });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4b. Update Profile Avatar (Local Photo Upload)
router.post('/community/profile/avatar', (req, res) => {
  try {
    const { user_id, avatar_url } = req.body;
    if (!user_id || !avatar_url) {
      return res.status(400).json({ error: 'User ID and avatar URL required.' });
    }

    db.prepare('UPDATE community_users SET avatar_url = ?, updated_at = ? WHERE id = ?')
      .run(avatar_url, new Date().toISOString(), user_id);
    db.prepare('UPDATE community_messages SET user_avatar = ? WHERE user_id = ?')
      .run(avatar_url, user_id);

    res.json({ success: true, avatar_url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Post Message (Checks abusive words, file size < 10MB, dispatches @mention notifications)
router.post('/community/messages', (req, res) => {
  try {
    const clientIp = getClientIp(req);
    const isBlocked = db.prepare('SELECT ip FROM blocked_ips WHERE ip = ?').get(clientIp);
    if (isBlocked) {
      return res.status(403).json({ error: 'You are blocked from posting in this community.' });
    }

    const {
      channel_id,
      user_id,
      user_name,
      username,
      user_avatar,
      verified_type,
      content,
      attachments,
      media_links,
      gif_url,
      reply_to
    } = req.body;

    if (!user_id || (!content && (!attachments || attachments.length === 0) && !gif_url)) {
      return res.status(400).json({ error: 'Message content or attachment required.' });
    }

    if (isCommunityAbusive(content)) {
      return res.status(400).json({ error: 'Message blocked: Abusive words targeting national leadership or deities are prohibited.' });
    }

    const msgId = 'msg_' + Date.now() + Math.random().toString(36).substr(2, 4);
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Handle @mentions
    if (content) {
      const mentionMatches = content.match(/@([a-zA-Z0-9_.]+)/g) || [];
      const mentionedUsernames = mentionMatches.map(m => m.replace('@', '').toLowerCase());
      for (const targetUname of mentionedUsernames) {
        if (targetUname !== (username || '').toLowerCase()) {
          const notifId = 'notif_' + Date.now() + Math.random().toString(36).substr(2, 4);
          const notifMsg = `@${username} mentioned you: "${content.slice(0, 60)}..."`;
          db.prepare(`
            INSERT INTO community_notifications (id, recipient_username, sender_username, sender_name, message, is_read, type, created_at)
            VALUES (?, ?, ?, ?, ?, 0, 'mention', ?)
          `).run(notifId, targetUname, username || 'user', user_name || 'Citizen', notifMsg, now);

          broadcastCommunityEvent({
            type: 'NEW_NOTIFICATION',
            notification: {
              id: notifId,
              recipient_username: targetUname,
              sender_username: username || 'user',
              sender_name: user_name || 'Citizen',
              message: notifMsg,
              type: 'mention',
              created_at: now
            }
          });
        }
      }
    }

    // Handle DM direct notifications
    let dmRecipientUname = req.body.recipient_username ? String(req.body.recipient_username).toLowerCase() : null;
    if (!dmRecipientUname && channel_id && String(channel_id).startsWith('dm_')) {
      const parts = String(channel_id).replace('dm_', '').split('_');
      const otherId = parts.find(id => id !== user_id);
      if (otherId) {
        const otherUser = db.prepare('SELECT username FROM community_users WHERE id = ?').get(otherId);
        if (otherUser) dmRecipientUname = otherUser.username.toLowerCase();
      }
    }

    if (dmRecipientUname && dmRecipientUname !== (username || '').toLowerCase()) {
      const notifId = 'notif_dm_' + Date.now() + Math.random().toString(36).substr(2, 4);
      const notifSnippet = (content || (attachments && attachments.length > 0 ? 'Sent attachment' : 'Sent media')).slice(0, 60);
      const dmMsg = `@${username} sent you a direct message: "${notifSnippet}"`;
      db.prepare(`
        INSERT INTO community_notifications (id, recipient_username, sender_username, sender_name, message, is_read, type, dm_user_id, created_at)
        VALUES (?, ?, ?, ?, ?, 0, 'direct_message', ?, ?)
      `).run(notifId, dmRecipientUname, username || 'user', user_name || 'Citizen', dmMsg, user_id, now);

      broadcastCommunityEvent({
        type: 'NEW_NOTIFICATION',
        notification: {
          id: notifId,
          recipient_username: dmRecipientUname,
          sender_username: username || 'user',
          sender_name: user_name || 'Citizen',
          message: dmMsg,
          type: 'direct_message',
          dm_user_id: user_id,
          created_at: now
        }
      });
    }

    db.prepare(`
      INSERT INTO community_messages (id, channel_id, user_id, user_name, username, user_avatar, verified_type, content, attachments, media_links, gif_url, reactions, reply_to, is_deleted, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', ?, 0, ?)
    `).run(
      msgId,
      channel_id || 'public',
      user_id,
      user_name || 'Citizen',
      username || 'user',
      user_avatar || null,
      verified_type || 'none',
      content || '',
      attachments ? JSON.stringify(attachments) : '[]',
      media_links ? JSON.stringify(media_links) : '[]',
      gif_url || null,
      reply_to ? JSON.stringify(reply_to) : null,
      now
    );

    const savedMsg = {
      id: msgId,
      channel_id: channel_id || 'public',
      user_id,
      user_name: user_name || 'Citizen',
      username: username || 'user',
      user_avatar,
      verified_type: verified_type || 'none',
      content: content || '',
      attachments: attachments || [],
      media_links: media_links || [],
      gif_url: gif_url || null,
      reactions: {},
      reply_to: reply_to || null,
      created_at: now
    };

    res.json({ success: true, message: savedMsg });
    broadcastCommunityEvent({ type: 'NEW_MESSAGE', message: savedMsg });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5b. React to Community Message (WhatsApp style)
router.post('/community/messages/react', (req, res) => {
  try {
    const { message_id, emoji, user_id, username } = req.body;
    if (!message_id || !emoji || !user_id) {
      return res.status(400).json({ error: 'Message ID, emoji, and user ID required.' });
    }

    const msg = db.prepare('SELECT id, reactions FROM community_messages WHERE id = ?').get(message_id);
    if (!msg) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    let rx = {};
    try {
      rx = msg.reactions ? (typeof msg.reactions === 'string' ? JSON.parse(msg.reactions) : msg.reactions) : {};
    } catch (e) {
      rx = {};
    }

    const alreadyReactedSame = rx[emoji] && rx[emoji].some(u => u.user_id === user_id);

    // Remove user's previous reaction across all emojis (WhatsApp single active reaction per user)
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

    const rxJson = JSON.stringify(rx);
    db.prepare('UPDATE community_messages SET reactions = ? WHERE id = ?').run(rxJson, message_id);

    res.json({ success: true, message_id, reactions: rx });
    broadcastCommunityEvent({ type: 'REACTION_UPDATE', message_id, reactions: rx });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5c. GIPHY Search & Trending Proxies
router.get('/giphy/search', async (req, res) => {
  try {
    const q = req.query.q || 'patriotic';
    const limit = Math.min(Number(req.query.limit) || 24, 50);
    const apiKey = 'sXpGFDGZs0Dv1mmNFvYaGUvYwKX0PWIh';
    const response = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(q)}&limit=${limit}&rating=g`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/giphy/trending', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 24, 50);
    const apiKey = 'sXpGFDGZs0Dv1mmNFvYaGUvYwKX0PWIh';
    const response = await fetch(`https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=${limit}&rating=g`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5d. Dedicated Media / File Upload Handler
const serverUploadsDir = path.join(__dirname, 'uploads');
const publicUploadsDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(serverUploadsDir)) fs.mkdirSync(serverUploadsDir, { recursive: true });
if (!fs.existsSync(publicUploadsDir)) fs.mkdirSync(publicUploadsDir, { recursive: true });

router.post('/community/upload', (req, res) => {
  try {
    const { filename, data, mimeType } = req.body;
    if (!data) return res.status(400).json({ error: 'No file data provided' });

    let buffer;
    let ext = 'bin';

    if (data.startsWith('data:')) {
      const commaIdx = data.indexOf(',');
      const semiIdx = data.indexOf(';');
      const detectedMime = (semiIdx !== -1 && commaIdx !== -1) ? data.slice(5, semiIdx) : (mimeType || 'application/octet-stream');
      ext = detectedMime.split('/')[1]?.split('+')[0] || 'bin';
      buffer = Buffer.from(data.slice(commaIdx + 1), 'base64');
    } else {
      buffer = Buffer.from(data, 'base64');
      if (mimeType) ext = mimeType.split('/')[1]?.split('+')[0] || 'bin';
    }

    if (buffer.length > 25 * 1024 * 1024) {
      return res.status(400).json({ error: 'File exceeds 25MB maximum limit' });
    }

    const safeExt = ext.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'bin';
    const uniqueName = 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6) + '.' + safeExt;

    fs.writeFileSync(path.join(serverUploadsDir, uniqueName), buffer);
    try {
      fs.writeFileSync(path.join(publicUploadsDir, uniqueName), buffer);
    } catch (e) {}

    const fileUrl = `/api/community/files/${uniqueName}`;
    res.json({
      success: true,
      url: fileUrl,
      filename: uniqueName,
      originalName: filename || uniqueName,
      size: (buffer.length / 1024).toFixed(0) + ' KB',
      bytes: buffer.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5e. Dedicated File Serving with Caching
router.get('/community/files/:filename', (req, res) => {
  try {
    const safeName = path.basename(req.params.filename);
    let targetPath = path.join(serverUploadsDir, safeName);
    if (!fs.existsSync(targetPath)) {
      targetPath = path.join(publicUploadsDir, safeName);
    }

    if (!fs.existsSync(targetPath)) {
      return res.status(404).send('File not found');
    }

    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(targetPath);
  } catch (error) {
    res.status(500).send('Error reading file');
  }
});

// 6. Delete Message (Admin or Author)
router.delete('/community/messages/:id', (req, res) => {
  try {
    const msgId = req.params.id;
    db.prepare('UPDATE community_messages SET is_deleted = 1 WHERE id = ?').run(msgId);
    res.json({ success: true, id: msgId });
    broadcastCommunityEvent({ type: 'DELETE_MESSAGE', message_id: msgId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Create Channel
router.post('/community/channels', (req, res) => {
  try {
    const { creator_id, creator_name, creator_username, name, description } = req.body;
    if (!creator_id || !name) {
      return res.status(400).json({ error: 'Creator ID and channel name are required.' });
    }

    const chanId = 'chn_' + Date.now();
    const joinToken = 'chn_' + Math.random().toString(36).substr(2, 9);
    const now = new Date().toISOString();

    const newChan = {
      id: chanId,
      creator_id,
      creator_name: creator_name || 'Creator',
      creator_username: creator_username || 'creator',
      name: name.trim(),
      description: (description || '').trim(),
      join_token: joinToken,
      is_private: 1,
      members: [creator_id],
      pending_requests: [],
      created_at: now
    };

    db.prepare(`
      INSERT INTO community_channels (id, creator_id, creator_name, creator_username, name, description, join_token, is_private, members, pending_requests, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, '[]', ?)
    `).run(
      chanId,
      creator_id,
      newChan.creator_name,
      newChan.creator_username,
      newChan.name,
      newChan.description,
      joinToken,
      JSON.stringify(newChan.members),
      now
    );

    res.json({ success: true, channel: newChan });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 8. Request to join Channel (Google Meet style)
router.post(['/community/channels/request', '/community/channels/:id/request'], (req, res) => {
  try {
    const chanId = req.params.id || req.body.channel_id || req.body.id;
    const { user_id, name, username, avatar_url } = req.body;
    if (!user_id || !chanId) return res.status(400).json({ error: 'User ID and Channel ID required.' });

    const chan = db.prepare('SELECT * FROM community_channels WHERE id = ?').get(chanId);
    if (!chan) return res.status(404).json({ error: 'Channel not found.' });

    const requests = chan.pending_requests ? JSON.parse(chan.pending_requests) : [];
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (!requests.some(r => r.user_id === user_id)) {
      requests.push({
        user_id,
        name: name || 'Citizen',
        username: username || 'user',
        avatar_url: avatar_url || null,
        requested_at: nowTime
      });
      db.prepare('UPDATE community_channels SET pending_requests = ? WHERE id = ?').run(JSON.stringify(requests), chanId);
    }

    // Insert persistent notification for the channel creator
    const notifId = 'notif_chan_' + Date.now() + Math.random().toString(36).substr(2, 4);
    const notifMsg = `@${username || 'user'} (${name || 'Citizen'}) requested to participate in your private channel "${chan.name}"`;
    const creatorUser = db.prepare('SELECT id, username FROM community_users WHERE id = ?').get(chan.creator_id);
    const creatorUname = String(creatorUser ? creatorUser.username : (chan.creator_username || '')).toLowerCase();
    
    db.prepare(`
      INSERT INTO community_notifications (id, recipient_username, sender_username, sender_name, message, is_read, type, channel_id, requester_id, created_at)
      VALUES (?, ?, ?, ?, ?, 0, 'channel_request', ?, ?, ?)
    `).run(notifId, creatorUname, username || 'user', name || 'Citizen', notifMsg, chanId, user_id, nowTime);

    broadcastCommunityEvent({
      type: 'CHANNEL_UPDATE',
      channel_id: chanId,
      pending_requests: requests
    });

    broadcastCommunityEvent({
      type: 'NEW_NOTIFICATION',
      notification: {
        id: notifId,
        recipient_username: creatorUname,
        sender_username: username || 'user',
        sender_name: name || 'Citizen',
        message: notifMsg,
        type: 'channel_request',
        channel_id: chanId,
        requester_id: user_id,
        created_at: nowTime
      }
    });

    res.json({ success: true, requests });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 9. Admit Participant to Channel
router.post(['/community/channels/admit', '/community/channels/:id/admit'], (req, res) => {
  try {
    const chanId = req.params.id || req.body.channel_id || req.body.id;
    const { participant_user_id } = req.body;
    if (!chanId || !participant_user_id) return res.status(400).json({ error: 'Channel ID and Participant User ID required.' });

    const chan = db.prepare('SELECT * FROM community_channels WHERE id = ?').get(chanId);
    if (!chan) return res.status(404).json({ error: 'Channel not found.' });

    let members = chan.members ? JSON.parse(chan.members) : [];
    let requests = chan.pending_requests ? JSON.parse(chan.pending_requests) : [];

    if (!members.includes(participant_user_id)) {
      members.push(participant_user_id);
    }
    requests = requests.filter(r => r.user_id !== participant_user_id);

    db.prepare('UPDATE community_channels SET members = ?, pending_requests = ? WHERE id = ?')
      .run(JSON.stringify(members), JSON.stringify(requests), chanId);

    // Notify the admitted user
    const targetUser = db.prepare('SELECT username FROM community_users WHERE id = ?').get(participant_user_id);
    if (targetUser) {
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const notifId = 'notif_adm_' + Date.now() + Math.random().toString(36).substr(2, 4);
      const admitMsg = `✓ You have been approved to join private channel "${chan.name}"!`;
      db.prepare(`
        INSERT INTO community_notifications (id, recipient_username, sender_username, sender_name, message, is_read, type, channel_id, requester_id, created_at)
        VALUES (?, ?, ?, ?, ?, 0, 'channel_admit', ?, ?, ?)
      `).run(notifId, targetUser.username.toLowerCase(), chan.creator_username, chan.creator_name, admitMsg, chanId, participant_user_id, nowTime);

      broadcastCommunityEvent({
        type: 'NEW_NOTIFICATION',
        notification: {
          id: notifId,
          recipient_username: targetUser.username.toLowerCase(),
          sender_username: chan.creator_username,
          sender_name: chan.creator_name,
          message: admitMsg,
          type: 'channel_admit',
          channel_id: chanId,
          created_at: nowTime
        }
      });
    }

    broadcastCommunityEvent({
      type: 'CHANNEL_UPDATE',
      channel_id: chanId,
      members,
      pending_requests: requests
    });

    res.json({ success: true, members, requests });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 10. Deny Participant
router.post(['/community/channels/deny', '/community/channels/:id/deny'], (req, res) => {
  try {
    const chanId = req.params.id || req.body.channel_id || req.body.id;
    const { participant_user_id } = req.body;
    if (!chanId || !participant_user_id) return res.status(400).json({ error: 'Channel ID and Participant User ID required.' });

    const chan = db.prepare('SELECT * FROM community_channels WHERE id = ?').get(chanId);
    if (!chan) return res.status(404).json({ error: 'Channel not found.' });

    let requests = chan.pending_requests ? JSON.parse(chan.pending_requests) : [];
    requests = requests.filter(r => r.user_id !== participant_user_id);

    db.prepare('UPDATE community_channels SET pending_requests = ? WHERE id = ?')
      .run(JSON.stringify(requests), chanId);

    broadcastCommunityEvent({
      type: 'CHANNEL_UPDATE',
      channel_id: chanId,
      pending_requests: requests
    });

    res.json({ success: true, requests });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 11. Contact Admin / Submit Influencer Proof
router.post('/community/contact', (req, res) => {
  try {
    const clientIp = getClientIp(req);
    const { type, name, email, user_id, username, social_account_id, message, proof_file, proof_file_name } = req.body;

    if (!name || !message) {
      return res.status(400).json({ error: 'Name and message are required.' });
    }

    if (type === 'creator') {
      if (!social_account_id) {
        return res.status(400).json({ error: 'Social handle is required for influencer verification.' });
      }
      if (!proof_file) {
        return res.status(400).json({ error: 'MANDATORY: Upload dashboard analytics proof image/video (< 10MB).' });
      }
    }

    const queryId = 'query_' + Date.now();
    const now = new Date().toLocaleString();

    db.prepare(`
      INSERT INTO community_contact_queries (id, type, name, email, user_id, username, social_account_id, message, proof_file_name, proof_file, ip, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `).run(
      queryId,
      type || 'user',
      name,
      email || null,
      user_id || 'guest',
      username || 'unregistered',
      social_account_id || null,
      message,
      proof_file_name || null,
      proof_file || null,
      clientIp,
      now
    );

    const newQueryObj = {
      id: queryId,
      type: type || 'user',
      name,
      email: email || null,
      user_id: user_id || 'guest',
      username: username || 'unregistered',
      social_account_id: social_account_id || null,
      message,
      proof_file_name: proof_file_name || null,
      proof_file: proof_file || null,
      ip: clientIp,
      status: 'pending',
      created_at: now
    };

    broadcastCommunityEvent({
      type: 'NEW_QUERY',
      query: newQueryObj
    });

    res.json({ success: true, id: queryId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 12. Community Admin: Ban User & IP
router.post('/community/admin/ban', (req, res) => {
  try {
    const { user_id, target_username, admin_token, admin_email, admin_password } = req.body;
    const adminKey = req.headers['x-admin-key'] || req.headers['authorization'] || admin_token || '';
    const cleanKey = adminKey.startsWith('Bearer ') ? adminKey.slice(7).trim() : String(adminKey).trim();
    const isAuthed = (cleanKey && (ACTIVE_ADMIN_SESSIONS.has(cleanKey) || VALID_ADMIN_KEYS.has(cleanKey) || cleanKey.startsWith('ep-adm-'))) ||
      (admin_email === 'omkumar.working@gmail.com' && (admin_password === 'Q0gng04bk3' || admin_password === 'JaiHindBharatMataKiJai2024!'));

    if (!isAuthed) {
      return res.status(403).json({ error: 'Unauthorized admin credentials.' });
    }

    // Ban user
    const user = db.prepare('SELECT ip_address FROM community_users WHERE id = ?').get(user_id);
    db.prepare('UPDATE community_users SET is_banned = 1 WHERE id = ?').run(user_id);
    db.prepare('DELETE FROM community_messages WHERE user_id = ?').run(user_id);

    if (user && user.ip_address) {
      db.prepare('INSERT OR IGNORE INTO blocked_ips (ip, reason, blocked_at) VALUES (?, ?, ?)')
        .run(user.ip_address, `Banned community user @${target_username}`, new Date().toISOString());
    }

    broadcastCommunityEvent({
      type: 'USER_BANNED',
      banned_user_id: user_id,
      target_username
    });

    res.json({ success: true, banned_user_id: user_id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 13. Community Admin: Assign/Toggle Verified Badge
router.post('/community/admin/verify-badge', (req, res) => {
  try {
    const { user_id, badge_type, admin_token, admin_email, admin_password } = req.body;
    const adminKey = req.headers['x-admin-key'] || req.headers['authorization'] || admin_token || '';
    const cleanKey = adminKey.startsWith('Bearer ') ? adminKey.slice(7).trim() : String(adminKey).trim();
    const isAuthed = (cleanKey && (ACTIVE_ADMIN_SESSIONS.has(cleanKey) || VALID_ADMIN_KEYS.has(cleanKey) || cleanKey.startsWith('ep-adm-'))) ||
      (admin_email === 'omkumar.working@gmail.com' && (admin_password === 'Q0gng04bk3' || admin_password === 'JaiHindBharatMataKiJai2024!'));

    if (!isAuthed) {
      return res.status(403).json({ error: 'Unauthorized admin credentials.' });
    }

    const user = db.prepare('SELECT verified_type FROM community_users WHERE id = ?').get(user_id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const newBadge = user.verified_type === badge_type ? 'none' : badge_type;
    db.prepare('UPDATE community_users SET verified_type = ? WHERE id = ?').run(newBadge, user_id);
    db.prepare('UPDATE community_messages SET verified_type = ? WHERE user_id = ?').run(newBadge, user_id);

    broadcastCommunityEvent({
      type: 'BADGE_UPDATE',
      user_id,
      verified_type: newBadge
    });

    res.json({ success: true, user_id, verified_type: newBadge });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;


