const fs = require('fs');
const path = require('path');
const db = require('./db');

// Backup Directories (Inside project workspace and dist for hosting)
const BACKUP_DIRS = [
  path.join(__dirname, '..', 'v7', 'admin', 'om', 'backup'),
  path.join(__dirname, '..', 'public', 'v7', 'admin', 'om', 'backup'),
  path.join(__dirname, '..', 'dist', 'v7', 'admin', 'om', 'backup')
];

function ensureBackupDirectories() {
  for (const dir of BACKUP_DIRS) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch (e) {
      console.error('Error creating backup dir:', dir, e.message);
    }
  }
}

// Generate full SQL statements for MySQL
function generateMySqlDump(entities, reports, nationalists = []) {
  let sql = `-- Exposed Propagandus Database Dump\n`;
  sql += `-- Auto-generated on: ${new Date().toISOString()}\n\n`;
  sql += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;

  if (entities.length > 0) {
    sql += `INSERT INTO \`entities\` (\`id\`, \`name\`, \`handle_x\`, \`handle_yt\`, \`handle_insta\`, \`avatar_url\`, \`categories\`, \`party\`, \`institution\`, \`narrative\`, \`fact_check\`, \`proof_url\`, \`upvotes\`, \`is_verified\`, \`submitted_by_ip\`, \`created_at\`, \`updated_at\`) VALUES\n`;
    const rows = entities.map((e) => {
      const escape = (val) => (val === null || val === undefined ? 'NULL' : `'${String(val).replace(/'/g, "\\'")}'`);
      return `(${escape(e.id)}, ${escape(e.name)}, ${escape(e.handle_x)}, ${escape(e.handle_yt)}, ${escape(e.handle_insta)}, ${escape(e.avatar_url)}, ${escape(e.categories)}, ${escape(e.party)}, ${escape(e.institution)}, ${escape(e.narrative)}, ${escape(e.fact_check)}, ${escape(e.proof_url)}, ${e.upvotes || 0}, ${e.is_verified || 1}, ${escape(e.submitted_by_ip)}, ${escape(e.created_at)}, ${escape(e.updated_at)})`;
    });
    sql += rows.join(',\n') + `\nON DUPLICATE KEY UPDATE \`upvotes\`=VALUES(\`upvotes\`), \`narrative\`=VALUES(\`narrative\`);\n\n`;
  }

  if (nationalists.length > 0) {
    sql += `INSERT INTO \`nationalist_influencers\` (\`id\`, \`name\`, \`handle_x\`, \`handle_yt\`, \`handle_insta\`, \`avatar_url\`, \`category\`, \`description\`, \`status\`, \`upvotes\`, \`suggested_by_ip\`, \`created_at\`, \`updated_at\`) VALUES\n`;
    const rowsNat = nationalists.map((n) => {
      const escape = (val) => (val === null || val === undefined ? 'NULL' : `'${String(val).replace(/'/g, "\\'")}'`);
      return `(${escape(n.id)}, ${escape(n.name)}, ${escape(n.handle_x)}, ${escape(n.handle_yt)}, ${escape(n.handle_insta)}, ${escape(n.avatar_url)}, ${escape(n.category)}, ${escape(n.description)}, ${escape(n.status)}, ${n.upvotes || 0}, ${escape(n.suggested_by_ip)}, ${escape(n.created_at)}, ${escape(n.updated_at)})`;
    });
    sql += rowsNat.join(',\n') + `\nON DUPLICATE KEY UPDATE \`upvotes\`=VALUES(\`upvotes\`), \`status\`=VALUES(\`status\`);\n\n`;
  }

  sql += `SET FOREIGN_KEY_CHECKS = 1;\n`;
  return sql;
}

// Perform real-time safe backup to hosting disk folder
function performRealtimeBackup() {
  try {
    ensureBackupDirectories();

    const entities = db.prepare('SELECT * FROM entities ORDER BY created_at DESC').all();
    const reports = db.prepare('SELECT * FROM reports ORDER BY created_at DESC').all();
    const blockedIps = db.prepare('SELECT * FROM blocked_ips').all();
    const nationalists = db.prepare('SELECT * FROM nationalist_influencers ORDER BY created_at DESC').all();
    let blockedAttempts = [];
    try {
      blockedAttempts = db.prepare('SELECT * FROM blocked_attempts ORDER BY created_at DESC').all();
    } catch (e) {}

    const backupPayload = {
      timestamp: new Date().toISOString(),
      platform: 'Exposed Propagandus',
      domain: 'exposedpropagandus.is-best.net',
      totalEntities: entities.length,
      totalReports: reports.length,
      totalNationalists: nationalists.length,
      data: {
        entities,
        reports,
        nationalists,
        blockedIps,
        blockedAttempts
      }
    };

    const jsonString = JSON.stringify(backupPayload, null, 2);
    const sqlDump = generateMySqlDump(entities, reports, nationalists);
    const dateStr = new Date().toISOString().split('T')[0];

    for (const dir of BACKUP_DIRS) {
      try {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        // 1. Primary real-time JSON backup file
        fs.writeFileSync(path.join(dir, 'propagandus_live_backup.json'), jsonString, 'utf8');

        // 2. MySQL Dump for instant phpMyAdmin import
        fs.writeFileSync(path.join(dir, 'propagandus_live_dump.sql'), sqlDump, 'utf8');

        // 3. Daily archive snapshot
        fs.writeFileSync(path.join(dir, `propagandus_backup_${dateStr}.json`), jsonString, 'utf8');
      } catch (e) {
        // Continue to other backup folders
      }
    }

    console.log(`[BACKUP] Real-time backup saved to v7/admin/om/backup (${entities.length} records)`);
  } catch (err) {
    console.error('[BACKUP ERROR]', err.message);
  }
}

module.exports = {
  performRealtimeBackup,
  ensureBackupDirectories
};
