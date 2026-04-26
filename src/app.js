const express = require('express');
const cors = require('cors');
const path = require('path');
const kb = require('./services/knowledgeService');
const { handleChat } = require('./controllers/chatController');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.post('/api/chat', handleChat);

// Health Check / Projects list
app.get('/api/projects', (req, res) => {
  res.json(kb.getAllProjects().map(p => ({ title: p.title, file: p.fileName })));
});

// Initialization
const init = async () => {
  try {
    await kb.initialize();
  } catch (err) {
    console.error("Knowledge Base failed to load:", err);
  }
};

init();

// Export the app for Vercel
module.exports = app;

// Only start the server locally if not in a serverless environment
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`🤖 ${process.env.OWNER_FIRST_NAME.toUpperCase()}'S AI ASSISTANT ONLINE`);
    console.log(`📡 Deployment: http://localhost:${PORT}`);
    console.log(`📁 Knowledge Base initialized`);
    console.log(`========================================\n`);
  });
}
