if (process.loadEnvFile) {
  try {
    process.loadEnvFile();
  } catch (e) {}
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { checkBlockedIp, checkGeoRestriction, globalLimiter } = require('./security');
const apiRoutes = require('./routes');

const app = express();
const PORT = process.env.PORT || 5000;

// Define distPath before routes
const distPath = path.join(__dirname, '..', 'dist');

// Trust proxy for accurate client IP detection behind reverse proxies & Codespaces
app.set('trust proxy', 1);

// Security Headers: allow iframe embedding for Codespaces preview & inline styles
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
  frameguard: false // Permissive for Codespaces webview & preview iframes
}));

// Enable CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
}));

// Parse JSON bodies (up to 10mb for backups)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Anti-DDoS & IP Blocking Middleware (only for /api routes)
app.use('/api', checkBlockedIp);
app.use('/api', checkGeoRestriction);
app.use('/api', globalLimiter);

// API Routes
app.use('/api', apiRoutes);

// Health checks
const sendHealth = (req, res) => {
  res.json({
    status: 'ONLINE',
    system: 'Exposed Propagandus Core',
    slogan: 'Bharat Mata ki Jai 🇮🇳',
    timestamp: new Date().toISOString()
  });
};
app.get('/health', sendHealth);
app.get('/api/health', sendHealth);

// Serve frontend static assets
app.use(express.static(distPath));

// Secret Admin Panel SPA Route (Express 5 RegExp compatible)
app.get(/^\/v7\/admin\/om/, (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  res.sendFile(indexPath);
});

// Fallback to index.html for SPA routing
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  const indexPath = path.join(distPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Exposed Propagandus</title>
            <style>
              body { font-family: sans-serif; background: #FFF7ED; text-align: center; padding: 50px; }
              h1 { color: #EA580C; }
            </style>
          </head>
          <body>
            <h1>Exposed Propagandus Backend Running</h1>
            <p>Bharat Mata ki Jai 🇮🇳</p>
            <p>Vite Frontend is being served on dev port or building.</p>
          </body>
        </html>
      `);
    }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`🛡️  EXPOSED PROPAGANDUS SECURE SERVER ONLINE`);
  console.log(`🇮🇳  Slogan: Bharat Mata ki Jai`);
  console.log(`🚀  Port: http://localhost:${PORT}`);
  console.log(`🔒  Admin Auth: Database Driven (admin_users)`);
  console.log(`====================================================`);
});
