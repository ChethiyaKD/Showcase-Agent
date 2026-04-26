# 🤖 Showcase Agent | AI-Powered Portfolio Assistant

Showcase Agent is a professional AI-driven bridge between developers and their audience. It transforms a static portfolio into an interactive, 24/7 technical representative capable of answering deep project questions, scheduling meetings, and qualifying leads.

![Showcase Agent Banner](https://img.shields.io/badge/AI-Portfolio_Agent-6366f1?style=for-the-badge&logo=openai)
![Stack](https://img.shields.io/badge/Stack-Node.js_|_React_|_OpenAI-blue?style=for-the-badge)

---

## 🌟 Key Features

- **🧠 RAG-Based Intelligence**: Uses Retrieval-Augmented Generation to browse through dozens of project summaries and provide evidence-backed answers.
- **📅 Smart Scheduling**: Built-in Google Calendar integration for instant meeting booking.
- **✉️ Lead Qualification**: Automatically captures visitor intent and sends detailed inquiry emails.
- **🎨 Modern Widget**: A sleek, embeddable React chat component with a premium glassmorphism UI.
- **📁 Markdown-Driven Knowledge**: No database required. The agent learns from your existing `.md` project summaries.

---

## 🏗️ Project Architecture

The project follows a clean **Service-Controller** pattern:

```text
├── src/
│   ├── controllers/      # Route handlers and chat flow logic
│   ├── services/         # Business logic (Knowledge, Email, Calendar)
│   └── app.js            # Express API entry point
├── widget/               # Embeddable React component (Vite-based)
├── config/               # Persona and system configurations
├── scripts/              # Data maintenance and utility tools
└── knowledge/            # [Private] Project data source (Markdown)
```

---

## 🚀 Getting Started

### 1. Installation
```bash
# Clone the repository
git clone https://github.com/ChethiyaKD/Showcase-Agent.git

# Install dependencies
yarn install
```

### 2. Configuration
Create a `.env` file in the root based on the provided samples:
```env
OPENAI_API_KEY=your_key
GOOGLE_CLIENT_ID=your_id
GOOGLE_CLIENT_SECRET=your_secret
EMAIL_USER=your_email
EMAIL_PASS=your_app_password
```

### 3. Personalize the Agent
Rename `config/personality.sample.json` to `personality.json` and update it with your own bio, links, and tone.

### 4. Running the App
```bash
# Start the backend (API)
yarn dev

# Start the widget (Frontend)
cd widget && yarn dev
```

---

## 🛠️ Maintenance Tools

Located in `/scripts`:
- **`bulk_update.py`**: Automated script to batch-edit markdown project summaries.
- **`get_google_token.js`**: Helper script to generate OAuth2 refresh tokens for Google Calendar.

---

## 📄 License

This project is open-source. Feel free to fork and adapt it for your own portfolio!

---
*Built with ❤️ by [Chethiya Kusal Dissanayake](https://github.com/ChethiyaKD)*
