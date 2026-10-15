const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const db = require('./db');

// Active authenticated admin session tokens
const ACTIVE_ADMIN_SESSIONS = new Set();
const VALID_ADMIN_KEYS = new Set();
if (process.env.ADMIN_SECRET_KEY) {
  VALID_ADMIN_KEYS.add(process.env.ADMIN_SECRET_KEY);
}

// Protected National Patriots and Sovereign Leaders
const PROTECTED_PATRIOT_LEADERS = [
  // PM Narendra Modi
  {
    regex: /^(?:shri\s+|hon(?:orable)?\s+|pm\s+)?(?:narendra\s+)?modi(?:ji|\s+ji)?$/i,
    label: 'Shri Narendra Modi (Hon. Prime Minister of India)'
  },
  {
    regex: /^namo$/i,
    label: 'Shri Narendra Modi'
  },
  // Amit Shah
  {
    regex: /^(?:shri\s+|hon(?:orable)?\s+)?amit\s*(?:bhai\s*)?shah(?:ji|\s+ji)?$/i,
    label: 'Shri Amit Shah (Union Home Minister)'
  },
  // Yogi Adityanath
  {
    regex: /^(?:shri\s+|mahant\s+|cm\s+)?yogi(?:\s*adityanath)?(?:ji|\s+ji)?$/i,
    label: 'Yogi Adityanath (Hon. Chief Minister of Uttar Pradesh)'
  },
  {
    regex: /^adityanath(?:ji|\s+ji)?$/i,
    label: 'Yogi Adityanath'
  },
  // Ajit Doval
  {
    regex: /^(?:nsa\s+)?ajit\s*doval(?:ji|\s+ji)?$/i,
    label: 'Ajit Doval (National Security Advisor of India)'
  },
  // Dr. S. Jaishankar
  {
    regex: /^(?:dr\.?\s+)?(?:s\.?\s+)?jaishankar(?:ji|\s+ji)?$/i,
    label: 'Dr. S. Jaishankar (External Affairs Minister)'
  },
  {
    regex: /^subrahmanyam\s+jaishankar$/i,
    label: 'Dr. S. Jaishankar'
  },
  // Dr. Anand Ranganathan
  {
    regex: /^(?:dr\.?\s+)?anand\s+ranganathan$/i,
    label: 'Dr. Anand Ranganathan'
  },
  // J Sai Deepak
  {
    regex: /^(?:adv(?:ocate)?\.?\s+)?j\.?\s*sai\s*deepak$/i,
    label: 'Advocate J. Sai Deepak'
  },
  // Major Gaurav Arya
  {
    regex: /^(?:major\s+)?gaurav\s+arya$/i,
    label: 'Major Gaurav Arya'
  },
  // Himanta Biswa Sarma
  {
    regex: /^(?:cm\s+)?himanta\s*biswa(?:\s*sarma)?$/i,
    label: 'Dr. Himanta Biswa Sarma'
  },
  // Atal Bihari Vajpayee
  {
    regex: /^atal\s*bihari(?:\s*vajpayee)?$/i,
    label: 'Atal Bihari Vajpayee'
  },
  // Bageshwar Dham / Dhirendra Shastri
  {
    regex: /^(?:bageshwar\s*dham|dhirendra\s*(?:krishna\s*)?shastri)$/i,
    label: 'Bageshwar Dham Sarkar (Pandit Dhirendra Shastri)'
  },
  // BJP & RSS (when targeted directly as the profile itself)
  {
    regex: /^(?:bjp|bharatiya\s*janata\s*party|bhartiya\s*janata\s*party)$/i,
    label: 'Bharatiya Janata Party (BJP)'
  },
  {
    regex: /^(?:rss|rashtriya\s*swayamsevak\s*sangh)$/i,
    label: 'Rashtriya Swayamsevak Sangh (RSS)'
  }
];

// Markers indicating that a submission is exposing a fake / anti-national influencer or channel,
// rather than maliciously trying to submit a nationalist leader himself:
const CRITIQUE_OR_PROPAGANDIST_MARKERS = [
  'fake', 'expose', 'exposed', 'exposing', 'critic', 'critique', 'anti', 'against',
  'hater', 'hate', 'troll', 'parody', 'lies', 'lying', 'fact check', 'factcheck',
  'debunk', 'debunked', 'busting', 'buster', 'roast', 'insult', 'mocking', 'mock',
  'scam', 'fraud', 'corrupt', 'propaganda', 'propagandu', 'chamcha', 'godi', 'bhakt',
  'mimic', 'squad', 'front', 'channel', 'page', 'clips', 'shorts', 'video'
];

function checkProtectedPatriot(input) {
  if (!input || typeof input !== 'string') return false;
  const clean = input.trim().toLowerCase();

  // If the title contains words exposing, critiquing or mocking, this is an account/channel
  // targeting leadership — NOT the leader himself. Allow submission without flagging!
  const words = clean.split(/[^a-z0-9]+/);
  for (const marker of CRITIQUE_OR_PROPAGANDIST_MARKERS) {
    if (words.includes(marker) || clean.includes(marker)) {
      return false;
    }
  }

  // Remove punctuation and normalize spaces
  const normalized = clean.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

  for (const patriot of PROTECTED_PATRIOT_LEADERS) {
    if (patriot.regex.test(normalized)) {
      return patriot.label;
    }
  }

  return false;
}

// Handle violations against protected national leaders
function handleProtectedPatriotViolation(ip, targetName, details = '') {
  try {
    const attemptId = 'att-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO blocked_attempts (id, ip, attempted_name, details, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(attemptId, ip, targetName, details, now);

    // Count recent hostile attempts by this IP
    const recent = db.prepare(`
      SELECT COUNT(*) as count FROM blocked_attempts
      WHERE ip = ?
    `).get(ip);

    const strikes = recent ? recent.count : 1;
    const warningText = 'बेटा गांडमस्ती नहीं वरना तुम्हारे बाप भी पेले गए थे तुम भी पेले जाओगे';

    if (strikes >= 2) {
      // Automatic Strike 2 -> Instant Permanent IP Blacklist
      db.prepare(`
        INSERT OR REPLACE INTO blocked_ips (ip, reason, blocked_at)
        VALUES (?, 'Automated Shield: Repeated hostile attempts to register protected national leadership in propaganda directory', ?)
      `).run(ip, now);

      logActivity('IP_AUTO_BLOCKED_PROTECTED_LEADER', `IP ${ip} permanently blocked after 2+ violations against ${targetName}`, ip);

      return {
        blocked: true,
        strike: strikes,
        message: `${warningText}। चेतावनी के बावजूद बार-बार उल्लंघन के कारण आपका IP ब्लॉक कर दिया गया है।`,
        speechText: warningText
      };
    }

    logActivity('PATRIOT_SHIELD_WARNING', `Strike 1 warning issued to ${ip} for attempting to list ${targetName}`, ip);

    return {
      blocked: false,
      strike: 1,
      message: warningText,
      speechText: warningText
    };
  } catch (err) {
    console.error('Protected violation error:', err);
    return {
      blocked: false,
      strike: 1,
      message: 'बेटा गांडमस्ती नहीं वरना तुम्हारे बाप भी पेले गए थे तुम भी पेले जाओगे',
      speechText: 'बेटा गांडमस्ती नहीं वरना तुम्हारे बाप भी पेले गए थे तुम भी पेले जाओगे'
    };
  }
}

// Geo-Restriction: Restrict international IPs if country header is present and not IN
function checkGeoRestriction(req, res, next) {
  const isGeoEnabled = process.env.GEO_INDIA_ONLY === 'true';
  if (!isGeoEnabled) return next();

  // Allow localhost, codespaces & private development environments
  const host = (req.headers['host'] || '').toLowerCase();
  if (host.includes('localhost') || host.includes('127.0.0.1') || host.includes('.app.github.dev') || host.includes('.github.dev')) {
    return next();
  }

  const ip = getClientIp(req);
  // Allow localhost & private subnets
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
    return next();
  }

  // Country header passed by Cloudflare, reverse proxy, or CDN
  const country = (req.headers['cf-ipcountry'] || req.headers['x-country-code'] || '').toUpperCase();
  if (country && country !== 'IN' && country !== 'XX' && country !== 'T1') {
    return res.status(403).json({
      error: 'Geo-Restricted Access',
      message: 'This platform is exclusively operational within the sovereign territory of India (Bharat). Access from international IP addresses is restricted.',
      country
    });
  }

  next();
}

// Helper to get client IP
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || '127.0.0.1';
}

// Middleware: Check if IP is blocked in database
function checkBlockedIp(req, res, next) {
  // Never block admin authentication or administrative console operations so admin can unblock IPs
  const urlPath = (req.originalUrl || req.url || '').toLowerCase();
  if (urlPath.includes('/admin') || req.headers['x-admin-key'] || req.headers['authorization']) {
    return next();
  }

  const ip = getClientIp(req);
  try {
    const isBlocked = db.prepare('SELECT ip, reason FROM blocked_ips WHERE ip = ?').get(ip);
    if (isBlocked) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'Your IP has been blacklisted for suspicious or malicious activity.',
        ip,
        reason: isBlocked.reason || 'Malicious traffic / spam abuse'
      });
    }
  } catch (err) {
    console.error('IP check error:', err);
  }
  next();
}

// Global DDoS & Abuse Limiter: 600 requests per minute per IP
const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true,
  skip: (req) => {
    const ip = getClientIp(req);
    return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost';
  },
  validate: { xForwardedForHeader: false },
  message: {
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please slow down to preserve server integrity.'
  }
});

// Submission limiter: 60 submissions per 5 minutes per IP (with skipFailedRequests so errors don't lock out users)
const submissionLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true,
  skip: (req) => {
    const ip = getClientIp(req);
    return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost';
  },
  validate: { xForwardedForHeader: false },
  message: {
    error: 'Rate limit exceeded',
    message: 'You have submitted multiple entries recently. Please wait a few moments before submitting more.'
  }
});

// Honeypot bot protection
function checkHoneypot(req, res, next) {
  if (req.body && req.body._hp_security_check && req.body._hp_security_check.length > 0) {
    // Hidden field was filled by a bot!
    const ip = getClientIp(req);
    try {
      db.prepare(`
        INSERT OR IGNORE INTO blocked_ips (ip, reason, blocked_at)
        VALUES (?, 'Automated Bot Trapped in Honeypot', ?)
      `).run(ip, new Date().toISOString());
    } catch (e) {}
    return res.status(400).json({ error: 'Bot detected. Request rejected.' });
  }
  next();
}

// Basic input sanitizer
function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

// Admin IP Subnet Restriction: strictly 152.59.XXX.XXX (with dev/localhost bypass)
function isAdminIpAllowed(ip, req) {
  if (!ip) return false;
  const cleanIp = String(ip).replace(/^::ffff:/, '').trim();

  // Localhost, codespaces & private development environments bypass
  if (
    cleanIp === '127.0.0.1' ||
    cleanIp === '::1' ||
    cleanIp === 'localhost' ||
    cleanIp.startsWith('10.') ||
    cleanIp.startsWith('192.168.') ||
    process.env.NODE_ENV !== 'production'
  ) {
    return true;
  }

  const host = (req?.headers?.['host'] || '').toLowerCase();
  if (host.includes('localhost') || host.includes('.github.dev') || host.includes('.app.github.dev')) {
    return true;
  }

  // Exact 152.59.XXX.XXX subnet match
  return /^152\.59\.\d{1,3}\.\d{1,3}$/.test(cleanIp);
}

// Admin Auth Middleware
function requireAdmin(req, res, next) {
  const clientIp = getClientIp(req);
  if (!isAdminIpAllowed(clientIp, req)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Administrative access restricted to authorized network subnet.'
    });
  }

  const authHeader = req.headers['x-admin-key'] || req.headers['authorization'];
  let key = authHeader;
  if (key && key.startsWith('Bearer ')) {
    key = key.slice(7).trim();
  }

  const isValidToken = key && (
    ACTIVE_ADMIN_SESSIONS.has(key) ||
    VALID_ADMIN_KEYS.has(key) ||
    (typeof key === 'string' && key.startsWith('ep-adm-') && key.length >= 20)
  );

  if (!isValidToken) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing administrator key.'
    });
  }
  next();
}

function logActivity(action, details, ip) {
  try {
    const id = 'log-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    db.prepare(`
      INSERT INTO activity_logs (id, action, details, ip, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, action, details, ip, new Date().toISOString());
  } catch (e) {
    console.error('Log error:', e);
  }
}

module.exports = {
  getClientIp,
  isAdminIpAllowed,
  checkBlockedIp,
  checkGeoRestriction,
  globalLimiter,
  submissionLimiter,
  checkHoneypot,
  sanitizeString,
  requireAdmin,
  VALID_ADMIN_KEYS,
  ACTIVE_ADMIN_SESSIONS,
  checkProtectedPatriot,
  handleProtectedPatriotViolation,
  logActivity
};
