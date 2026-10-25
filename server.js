const path = require('path');
const fs = require('fs');

// 1. Load environment variables at the very beginning of server initialization
const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath, override: true });
} else {
  require('dotenv').config({ override: true });
}

// 2. Safe startup diagnostic (reports presence only, never values)
const isGeminiKeySet = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
const activeModel = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
console.log(`[EcoTrace Config] Loaded environment from: ${fs.existsSync(envPath) ? envPath : 'Process Environment'}`);
console.log(`[EcoTrace Config] GEMINI_API_KEY: ${isGeminiKeySet ? 'Configured (present)' : 'Missing / Not Set'}`);
console.log(`[EcoTrace Config] GEMINI_MODEL: ${activeModel}`);

const express = require('express');
const cors = require('cors');

const { initDatabase } = require('./backend/db');
const apiRoutes = require('./backend/routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
initDatabase();

// Middleware
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Handle JSON / payload parser errors cleanly
app.use((err, req, res, next) => {
  if (err && (err.type === 'entity.too.large' || err.status === 413)) {
    return res.status(413).json({ success: false, error: 'Image payload exceeds maximum allowable upload limit.' });
  }
  next(err);
});

// API Routes
app.use('/api', apiRoutes);

// Static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Fallback to index.html for client-side navigation
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
const server = app.listen(PORT, () => {
  const isKeyReady = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
  const currentModel = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
  console.log(`\n==================================================`);
  console.log(`🌿 EcoTrace — City Waste Sorting & Recovery System`);
  console.log(`🚀 Server running at: http://localhost:${PORT}`);
  console.log(`🤖 AI Assistant: ${isKeyReady ? 'READY (' + currentModel + ')' : 'CONFIG REQUIRED (Missing GEMINI_API_KEY)'}`);
  console.log(`==================================================\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    const ALT_PORT = 3001;
    console.log(`Port ${PORT} in use, trying ${ALT_PORT}...`);
    app.listen(ALT_PORT, () => {
      console.log(`\n🌿 EcoTrace running at: http://localhost:${ALT_PORT}\n`);
    });
  } else {
    console.error('Server error:', err);
  }
});
