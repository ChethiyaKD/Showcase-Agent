/**
 * ONE-TIME SETUP SCRIPT — Get Google OAuth2 Refresh Token
 * Uses a local redirect server (replaces deprecated OOB flow).
 *
 * Steps:
 *  1. Make sure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are in .env
 *  2. Run:  node scratch/get_google_token.js
 *  3. Your browser will open automatically — sign in with chethiyakdis@gmail.com
 *  4. The refresh token will be printed automatically in the terminal
 *  5. Copy it into .env as GOOGLE_REFRESH_TOKEN=...
 */

const { google } = require('googleapis');
const http = require('http');
const url = require('url');
require('dotenv').config();

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI  = 'http://localhost:3333/callback';
const PORT          = 3333;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env');
  process.exit(1);
}

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/calendar'],
});

console.log('\n🔗 Opening browser for Google authorization...');
console.log('   Sign in with: chethiyakdis@gmail.com\n');

// Open the browser automatically
const { exec } = require('child_process');
exec(`open "${authUrl}"`);

// Start a temporary local server to catch the redirect
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  if (parsedUrl.pathname !== '/callback') return;

  const code = parsedUrl.query.code;
  if (!code) {
    res.end('❌ No authorization code received.');
    return;
  }

  res.end('<h2>✅ Authorization successful! You can close this tab and check your terminal.</h2>');
  server.close();

  try {
    const { tokens } = await oAuth2Client.getToken(code);
    console.log('✅ Authorization successful!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Add this line to your .env file:\n');
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🎉 Done! You only need to do this once.\n');
  } catch (err) {
    console.error('❌ Failed to exchange code:', err.message);
  }
});

server.listen(PORT, () => {
  console.log(`⏳ Waiting for Google to redirect to localhost:${PORT}...`);
});



