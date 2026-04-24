const express = require('express');
const cors = require('cors');
const path = require('path');
const kb = require('./knowledgeBase');
const { handleChat } = require('./chatController');
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
const startServer = async () => {
  try {
    await kb.initialize();
    app.listen(PORT, () => {
      console.log(`\n========================================`);
      console.log(`🤖 CHETHIYA'S AI ASSISTANT ONLINE`);
      console.log(`📡 Deployment: http://localhost:${PORT}`);
      console.log(`📁 Knowledge Base: ${kb.getAllProjects().length} projects loaded`);
      console.log(`========================================\n`);
    });
  } catch (err) {
    console.error("Critical Failure during Jarvis ignition:", err);
  }
};

startServer();
