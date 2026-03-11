import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database('ayurai.db');
const JWT_SECRET = process.env.JWT_SECRET || 'ayurveda-secret-key-123';

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER,
    role TEXT,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_cached BOOLEAN DEFAULT 0,
    FOREIGN KEY(chat_id) REFERENCES chats(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS ai_cache (
    prompt_hash TEXT PRIMARY KEY,
    response TEXT,
    language TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

try {
  db.exec('ALTER TABLE messages ADD COLUMN is_cached BOOLEAN DEFAULT 0');
} catch (e) {
  // Column might already exist, ignore
}

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// AI Cache Routes
app.get('/api/ai/cache', (req, res) => {
  const { prompt, lang } = req.query;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });
  
  // Simple normalization: lowercase and trim
  const normalizedPrompt = String(prompt).toLowerCase().trim();
  const cache = db.prepare('SELECT response FROM ai_cache WHERE prompt_hash = ? AND language = ?').get(normalizedPrompt, lang || 'English');
  
  if (cache) {
    res.json({ found: true, response: cache.response });
  } else {
    res.json({ found: false });
  }
});

app.post('/api/ai/cache', (req, res) => {
  const { prompt, response, lang } = req.body;
  if (!prompt || !response) return res.status(400).json({ error: 'Prompt and response are required' });
  
  const normalizedPrompt = String(prompt).toLowerCase().trim();
  try {
    db.prepare('INSERT OR REPLACE INTO ai_cache (prompt_hash, response, language) VALUES (?, ?, ?)').run(normalizedPrompt, response, lang || 'English');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cache response' });
  }
});

// Chat Routes
app.get('/api/chats', (req, res) => {
  const chats = db.prepare('SELECT * FROM chats ORDER BY created_at DESC').all();
  res.json(chats);
});

app.post('/api/chats', (req, res) => {
  const { title } = req.body;
  const info = db.prepare('INSERT INTO chats (title) VALUES (?)').run(title || 'New Chat');
  res.json({ id: info.lastInsertRowid, title: title || 'New Chat' });
});

app.get('/api/chats/:id/messages', (req, res) => {
  const messages = db.prepare('SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC').all(req.params.id);
  res.json(messages);
});

app.post('/api/messages', (req, res) => {
  const { chat_id, role, content, is_cached } = req.body;
  db.prepare('INSERT INTO messages (chat_id, role, content, is_cached) VALUES (?, ?, ?, ?)').run(chat_id, role, content, is_cached ? 1 : 0);
  res.json({ success: true });
});

app.delete('/api/chats/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM messages WHERE chat_id = ?').run(id);
  db.prepare('DELETE FROM chats WHERE id = ?').run(id);
  res.json({ success: true });
});

// Admin Settings (Public for now, or could use a simple secret key)
app.get('/api/admin/settings', (req, res) => {
  const settings = db.prepare('SELECT * FROM settings').all();
  res.json(settings);
});

app.post('/api/admin/settings', (req, res) => {
  const { key, value } = req.body;
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
  res.json({ success: true });
});

app.post('/api/admin/settings/bulk', (req, res) => {
  const { settings } = req.body; // Array of {key, value}
  if (!Array.isArray(settings)) return res.status(400).json({ error: 'Settings must be an array' });
  
  const insert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  const transaction = db.transaction((items) => {
    for (const item of items) insert.run(item.key, item.value);
  });
  
  try {
    transaction(settings);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

app.post('/api/admin/clear-cache', (req, res) => {
  db.prepare('DELETE FROM ai_cache').run();
  res.json({ success: true });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
