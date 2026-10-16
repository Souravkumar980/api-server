const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'propagandus.db');
const db = new Database(DB_PATH);

// Enable WAL mode for high performance concurrent reads and writes
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
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
    categories TEXT NOT NULL, -- JSON array
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


  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL,
    entity_name TEXT,
    report_type TEXT NOT NULL, -- 'Delete Request', 'Wrong Information', 'Edit'
    message TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'resolved', 'dismissed'
    reported_by_ip TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS comparisons (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    upa_period TEXT DEFAULT '2004 - 2014 (UPA)',
    upa_value TEXT NOT NULL,
    upa_details TEXT,
    nda_period TEXT DEFAULT '2014 - Present (NDA)',
    nda_value TEXT NOT NULL,
    nda_details TEXT,
    growth_badge TEXT,
    source TEXT,
    icon TEXT
  );

  CREATE TABLE IF NOT EXISTS blocked_ips (
    ip TEXT PRIMARY KEY,
    reason TEXT,
    blocked_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    details TEXT,
    ip TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS nationalist_influencers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    handle_x TEXT,
    handle_yt TEXT,
    handle_insta TEXT,
    avatar_url TEXT,
    category TEXT DEFAULT 'Nationalist Creator',
    description TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    upvotes INTEGER DEFAULT 0,
    suggested_by_ip TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS blocked_attempts (
    id TEXT PRIMARY KEY,
    ip TEXT NOT NULL,
    attempted_name TEXT NOT NULL,
    details TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS announcements (
    id TEXT PRIMARY KEY,
    title TEXT DEFAULT 'उद्घोषणा / ANNOUNCEMENT',
    message TEXT NOT NULL,
    type TEXT DEFAULT 'warning', -- 'alert', 'warning', 'info'
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS admin_posts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    image_url TEXT,
    badge TEXT DEFAULT 'DISPATCH',
    is_pinned INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS govt_polls (
    id TEXT PRIMARY KEY,
    question TEXT NOT NULL,
    yes_votes INTEGER DEFAULT 0,
    no_votes INTEGER DEFAULT 0,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS govt_poll_votes (
    poll_id TEXT NOT NULL,
    ip TEXT NOT NULL,
    choice TEXT NOT NULL,
    voted_at TEXT NOT NULL,
    PRIMARY KEY (poll_id, ip)
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS playlist_tracks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    video_id TEXT NOT NULL,
    author TEXT,
    thumbnail_url TEXT,
    duration TEXT,
    is_active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS site_visitors (
    ip TEXT PRIMARY KEY,
    device_type TEXT DEFAULT 'Desktop',
    os TEXT DEFAULT 'Unknown OS',
    browser TEXT DEFAULT 'Unknown Browser',
    user_agent TEXT,
    visit_count INTEGER DEFAULT 1,
    current_page TEXT DEFAULT 'Homepage',
    first_visited TEXT NOT NULL,
    last_seen TEXT NOT NULL,
    is_blocked INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS visitor_traffic_logs (
    id TEXT PRIMARY KEY,
    ip TEXT NOT NULL,
    device_type TEXT,
    os TEXT,
    browser TEXT,
    page TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS profile_votes (
    id TEXT PRIMARY KEY,
    target_id TEXT NOT NULL,
    target_type TEXT NOT NULL,
    ip TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(target_id, ip)
  );

  CREATE TABLE IF NOT EXISTS site_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(type, name)
  );

  CREATE TABLE IF NOT EXISTS community_users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
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
    channel_id TEXT NOT NULL DEFAULT 'public',
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    username TEXT NOT NULL,
    user_avatar TEXT,
    verified_type TEXT DEFAULT 'none',
    content TEXT NOT NULL,
    attachments TEXT,
    media_links TEXT,
    reactions TEXT DEFAULT '{}',
    reply_to TEXT DEFAULT NULL,
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
    join_token TEXT UNIQUE NOT NULL,
    is_private INTEGER DEFAULT 1,
    members TEXT,
    pending_requests TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS community_notifications (
    id TEXT PRIMARY KEY,
    recipient_username TEXT NOT NULL,
    sender_username TEXT NOT NULL,
    sender_name TEXT,
    message TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS community_contact_queries (
    id TEXT PRIMARY KEY,
    type TEXT DEFAULT 'user',
    name TEXT NOT NULL,
    email TEXT,
    user_id TEXT,
    username TEXT,
    social_account_id TEXT,
    message TEXT NOT NULL,
    proof_file_name TEXT,
    proof_file TEXT,
    ip TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TEXT NOT NULL
  );
`);

try { db.prepare("ALTER TABLE community_messages ADD COLUMN reactions TEXT DEFAULT '{}'").run(); } catch(e) {}
try { db.prepare("ALTER TABLE community_messages ADD COLUMN reply_to TEXT DEFAULT NULL").run(); } catch(e) {}
try { db.prepare("ALTER TABLE community_notifications ADD COLUMN type TEXT DEFAULT 'mention'").run(); } catch(e) {}
try { db.prepare("ALTER TABLE community_notifications ADD COLUMN channel_id TEXT DEFAULT NULL").run(); } catch(e) {}
try { db.prepare("ALTER TABLE community_notifications ADD COLUMN requester_id TEXT DEFAULT NULL").run(); } catch(e) {}
try { db.prepare("ALTER TABLE community_notifications ADD COLUMN dm_user_id TEXT DEFAULT NULL").run(); } catch(e) {}

// Seed default Admin in community_users
try {
  const chkAdmin = db.prepare('SELECT COUNT(*) as cnt FROM community_users WHERE email = ?').get('omkumar.working@gmail.com');
  if (chkAdmin.cnt === 0) {
    db.prepare(`
      INSERT INTO community_users (id, name, username, email, phone, password_hash, avatar_url, verified_type, is_admin, is_banned, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'usr_admin',
      'Om Kumar (Commander)',
      'omkumar_admin',
      'omkumar.working@gmail.com',
      '9876543210',
      'Q0gng04bk3',
      'https://api.dicebear.com/7.x/bottts/svg?seed=OmKumarAdmin',
      'influencer',
      1,
      0,
      new Date().toISOString(),
      new Date().toISOString()
    );
  }
} catch (e) {}

// Safe migrations for contact intel and multi-account links
try { db.exec("ALTER TABLE entities ADD COLUMN contact_phone TEXT;"); } catch(e) {}
try { db.exec("ALTER TABLE entities ADD COLUMN contact_email TEXT;"); } catch(e) {}
try { db.exec("ALTER TABLE entities ADD COLUMN other_links TEXT;"); } catch(e) {}
try { db.exec("ALTER TABLE nationalist_influencers ADD COLUMN other_links TEXT;"); } catch(e) {}

// Seed default Categories if empty
try {
  const countCat = db.prepare('SELECT COUNT(*) as count FROM site_categories').get();
  if (countCat.count === 0) {
    const insertCat = db.prepare(`
      INSERT OR IGNORE INTO site_categories (type, name, created_at)
      VALUES (?, ?, ?)
    `);
    const now = new Date().toISOString();
    const defaultNationalist = [
      'Defence',
      'Geopolitics',
      'Supporter',
      'Journalist',
      'Media',
      'Solo Influencer',
      'Sanatan Dharma',
      'International'
    ];
    for (const c of defaultNationalist) {
      insertCat.run('nationalist', c, now);
    }
    const defaultProp = [
      'Social Media',
      'Political Party',
      'Institutions',
      'Journalist',
      'YouTuber',
      'Academic',
      'Media House',
      'Foreign Entity',
      'Bureaucrat',
      'Activist',
      'NGO / Think Tank'
    ];
    for (const c of defaultProp) {
      insertCat.run('propagandist', c, now);
    }
  }
} catch (e) {}

// Seed default Admin User if empty
try {
  const countAdmin = db.prepare('SELECT COUNT(*) as count FROM admin_users').get();
  if (countAdmin.count === 0) {
    db.prepare(`
      INSERT INTO admin_users (id, email, password_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      'admin-primary',
      'omkumar.working@gmail.com',
      'Q0gng04bk3',
      new Date().toISOString(),
      new Date().toISOString()
    );
  }
} catch (e) {}

// Seed default Playlist Tracks if empty
try {
  const countTracks = db.prepare('SELECT COUNT(*) as count FROM playlist_tracks').get();
  if (countTracks.count === 0) {
    const insertTrack = db.prepare(`
      INSERT INTO playlist_tracks (id, title, video_id, author, thumbnail_url, duration, is_active, sort_order, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
    `);
    insertTrack.run('track-1', 'Aarambh Hai Prachand (आरंभ है प्रचंड)', 'Rz_K7Z4Lhls', 'Piyush Mishra', 'https://i.ytimg.com/vi/Rz_K7Z4Lhls/hqdefault.jpg', '4:46', 1, new Date().toISOString());
    insertTrack.run('track-2', 'Teri Mitti - Kesari | Akshay Kumar', 'wF_B_aagLfI', 'B Praak', 'https://i.ytimg.com/vi/wF_B_aagLfI/hqdefault.jpg', '5:14', 2, new Date().toISOString());
    insertTrack.run('track-3', 'Maa Tujhe Salaam - Vande Mataram', 'jDn2nbyT9iA', 'A.R. Rahman', 'https://i.ytimg.com/vi/jDn2nbyT9iA/hqdefault.jpg', '6:12', 3, new Date().toISOString());
  }
} catch (e) {}

// Seed default Govt Poll (BJP 2029 Mandate) - Starts at 0 Votes
const countPoll = db.prepare('SELECT COUNT(*) as count FROM govt_polls').get();
if (countPoll.count === 0) {
  db.prepare(`
    INSERT INTO govt_polls (id, question, yes_votes, no_votes, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    'bjp_2029',
    'Do you want BJP / NDA back in 2029?',
    0,
    0,
    new Date().toISOString()
  );
}

// Seed initial NDA vs UPA comparison data if empty
const countComparisons = db.prepare('SELECT COUNT(*) as count FROM comparisons').get();
if (countComparisons.count === 0) {
  const insertComp = db.prepare(`
    INSERT INTO comparisons (id, category, title, upa_period, upa_value, upa_details, nda_period, nda_value, nda_details, growth_badge, source, icon)
    VALUES (@id, @category, @title, @upa_period, @upa_value, @upa_details, @nda_period, @nda_value, @nda_details, @growth_badge, @source, @icon)
  `);

  const initialComparisons = [
    {
      id: 'comp-1',
      category: 'Economy & Global Stature',
      title: 'Global GDP Ranking & Economic Size',
      upa_period: '2004 - 2014 (UPA)',
      upa_value: '10th / 11th Largest (Fragile Five)',
      upa_details: 'Economy was ~$1.85 Trillion in 2014; plagued by high inflation (double-digit CPI), policy paralysis, and classified among "Fragile Five" global economies by Morgan Stanley.',
      nda_period: '2014 - 2024+ (NDA)',
      nda_value: '5th Largest Economy (Fastest Growing)',
      nda_details: 'Crossed ~$3.95 Trillion in 2024, overtook UK & France, on track to become 3rd largest global economy. Sustained 7%+ GDP growth with stable 4.5-5% inflation.',
      growth_badge: '+113% GDP Expansion',
      source: 'World Bank & IMF World Economic Outlook',
      icon: 'TrendingUp'
    },
    {
      id: 'comp-2',
      category: 'Infrastructure & Connectivity',
      title: 'National Highway Construction Speed',
      upa_period: '2004 - 2014 (UPA)',
      upa_value: '12 km / day',
      upa_details: 'Total NH network was 91,287 km in 2014. Projects routinely stalled due to bureaucratic delays and environmental clearances.',
      nda_period: '2014 - 2024+ (NDA)',
      nda_value: '37+ km / day (Peak 40 km/day)',
      nda_details: 'Total NH network expanded to 146,145+ km. Mega-expressways: Delhi-Mumbai, Purvanchal, Samruddhi Mahamarg, and Bharatmala Pariyojana transformed freight.',
      growth_badge: '3.1x Construction Speed',
      source: 'Ministry of Road Transport and Highways (MoRTH)',
      icon: 'Milestone'
    },
    {
      id: 'comp-3',
      category: 'Healthcare & Higher Education',
      title: 'All India Institute of Medical Sciences (AIIMS)',
      upa_period: '2004 - 2014 (UPA)',
      upa_value: '7 AIIMS Operational',
      upa_details: 'AIIMS New Delhi established in 1956; 6 announced under Vajpayee Ji in 2003 were slowly made partially operational by 2014.',
      nda_period: '2014 - 2024+ (NDA)',
      nda_value: '23+ AIIMS Operational / Underway',
      nda_details: '16 new world-class AIIMS launched including Gorakhpur, Jammu, Bilaspur, Rajkot, Mangalagiri, Deoghar, Guwahati, Bibinagar, and Madurai.',
      growth_badge: '+228% AIIMS Expansion',
      source: 'Ministry of Health and Family Welfare (MoHFW)',
      icon: 'Hospital'
    },
    {
      id: 'comp-4',
      category: 'Healthcare & Higher Education',
      title: 'IITs, IIMs & Medical Colleges',
      upa_period: '2004 - 2014 (UPA)',
      upa_value: '16 IITs | 13 IIMs | 387 Medical Colleges',
      upa_details: 'MBBS seats were only 51,348; severe shortage of doctor-patient ratio across tier-2 and rural India.',
      nda_period: '2014 - 2024+ (NDA)',
      nda_value: '23 IITs | 21 IIMs | 700+ Medical Colleges',
      nda_details: 'MBBS seats doubled to 108,000+; 7 new IITs, 8 new IIMs, and 15 new IIITs opened across states.',
      growth_badge: '+110% MBBS Seat Doubling',
      source: 'National Medical Commission (NMC) & Ministry of Education',
      icon: 'GraduationCap'
    },
    {
      id: 'comp-5',
      category: 'Hindutva Growth & Cultural Renaissance',
      title: 'Sacred Temples & Dharmic Civilizational Heritage',
      upa_period: '2004 - 2014 (UPA)',
      upa_value: 'Decades of Stagnation & Appeasement',
      upa_details: 'Affidavit submitted denying existence of Bhagwan Ram (Ram Setu case). Ancient temples neglected, Kashi & Ayodhya left in state of decay.',
      nda_period: '2014 - 2024+ (NDA)',
      nda_value: 'Grand Ayodhya Ram Mandir & Kashi Corridor',
      nda_details: 'Bhavya Ram Lalla Pran Pratishtha (Jan 2024), Kashi Vishwanath Dham Corridor (5 Lakh sq ft), Mahakal Lok Ujjain, Kedarnath Rebuilding, Somnath & Kartarpur Sahib revival.',
      growth_badge: 'Golden Era of Dharma',
      source: 'Ministry of Culture & Temple Development Trusts',
      icon: 'Flame'
    },
    {
      id: 'comp-6',
      category: 'Hindutva Growth & Cultural Renaissance',
      title: 'Article 370 Abrogation & Persecuted Minority Justice (CAA)',
      upa_period: '2004 - 2014 (UPA)',
      upa_value: 'Separate Constitution & Flag for J&K',
      upa_details: 'Stone pelting routine in Kashmir Valley, Kashmiri Pandits exiled, no fundamental rights for Valmikis/Gorkhas in J&K. No protection for persecuted Pakistani Hindus.',
      nda_period: '2014 - 2024+ (NDA)',
      nda_value: 'One Nation, One Constitution & CAA Enacted',
      nda_details: 'Historic abrogation of Article 370 & 35A on Aug 5, 2019. Tiranga raised at Lal Chowk. CAA citizenship granted to persecuted Hindus, Sikhs, Buddhists, Jains from Pak/BD/Afg.',
      growth_badge: '100% Complete Integration',
      source: 'Gazette of India & Ministry of Home Affairs',
      icon: 'ShieldCheck'
    },
    {
      id: 'comp-7',
      category: 'Defence & National Security',
      title: 'Defence Indigenous Production & Exports',
      upa_period: '2004 - 2014 (UPA)',
      upa_value: '₹1,500 Cr Exports | High Import Reliance',
      upa_details: 'India was branded the world’s largest arms importer; critical ammunition shortages (10-day reserves); scam-tainted procurement (VVIP Chopper scam).',
      nda_period: '2014 - 2024+ (NDA)',
      nda_value: '₹21,083+ Cr Exports | Indigenous Might',
      nda_details: 'India now exports defence weapons to 85+ countries (BrahMos to Philippines). Commissioned INS Vikrant (indigenous aircraft carrier), Tejas Mk1A, Prachand LCH.',
      growth_badge: '14x Surge in Defence Exports',
      source: 'Department of Defence Production (DDP)',
      icon: 'Shield'
    },
    {
      id: 'comp-8',
      category: 'Defence & National Security',
      title: 'Counter-Terrorism & Cross-Border Deterrence',
      upa_period: '2004 - 2014 (UPA)',
      upa_value: 'Passive Dossier Diplomacy',
      upa_details: '26/11 Mumbai terror attacks, 2008 serial blasts across Delhi/Jaipur/Ahmedabad. Response was sending protest dossiers to Pakistan.',
      nda_period: '2014 - 2024+ (NDA)',
      nda_value: 'Surgical Strikes & Balakot Air Strikes',
      nda_details: 'Zero tolerance doctrine. Uri avenged with 2016 Surgical Strike; Pulwama avenged with 2019 Balakot Mirage-2000 air strikes inside Pakistani territory.',
      growth_badge: 'New Doctrine of Strong Deterrence',
      source: 'Indian Armed Forces & Ministry of Defence',
      icon: 'Target'
    },
    {
      id: 'comp-9',
      category: 'Economy & Global Stature',
      title: 'Digital India & UPI Revolution',
      upa_period: '2004 - 2014 (UPA)',
      upa_value: 'Cash Economy & Middlemen Cut',
      upa_details: 'Former PM Rajiv Gandhi famously stated: "Only 15 paise of 1 rupee reaches the poor." Cash leakages and rampant corruption in welfare delivery.',
      nda_period: '2014 - 2024+ (NDA)',
      nda_value: '13+ Billion Monthly UPI Transactions',
      nda_details: 'India accounts for 46% of all real-time digital payments globally. Direct Benefit Transfer (DBT) sent ₹34+ Lakh Crore directly into Jan Dhan accounts, saving ₹3 Lakh Cr+ leakages.',
      growth_badge: 'World #1 in Digital Payments',
      source: 'National Payments Corporation of India (NPCI) & World Bank',
      icon: 'Smartphone'
    },
    {
      id: 'comp-10',
      category: 'Governance & Welfare',
      title: 'Sanitation (Swachh Bharat) & Tap Water (Jal Jeevan)',
      upa_period: '2004 - 2014 (UPA)',
      upa_value: '38.7% Sanitation | 17% Rural Tap Water',
      upa_details: 'Over 60 Crore citizens lacked basic toilet dignity. Only 3.23 Crore rural homes had functional household tap water connections.',
      nda_period: '2014 - 2024+ (NDA)',
      nda_value: '100% Toilet Coverage | 76%+ Tap Water',
      nda_details: '11.5+ Crore household toilets built under Swachh Bharat Mission. 15+ Crore rural homes provided tap water under Jal Jeevan Mission.',
      growth_badge: '+12 Crore Tap Connections',
      source: 'Ministry of Jal Shakti & WHO / UNICEF Joint Monitoring Programme',
      icon: 'Droplet'
    }
  ];

  for (const item of initialComparisons) {
    insertComp.run(item);
  }
}

module.exports = db;

