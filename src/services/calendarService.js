const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config();

// ─── Availability Configuration (IST = UTC+5:30) ──────────────────────────────
const IST_OFFSET_MINUTES = 330;
const OWNER_EMAIL = process.env.OWNER_EMAIL;

const AVAILABILITY = {
  weekday: { start: 10, end: 22 },    // 10:00 AM – 10:00 PM IST (Mon-Fri)
  weekend: { start: 11, end: 24 },    // 11:00 AM – 12:00 AM IST (Sat-Sun)
};

function toIST(utcDate) {
  return new Date(utcDate.getTime() + IST_OFFSET_MINUTES * 60 * 1000);
}

function checkAvailability(startISO) {
  const startUTC = new Date(startISO);
  if (isNaN(startUTC.getTime())) {
    return { available: false, istTimeStr: '', reason: 'Invalid date format provided.' };
  }

  const startIST = toIST(startUTC);
  const dayOfWeek = startIST.getUTCDay();
  const hour = startIST.getUTCHours();
  const minute = startIST.getUTCMinutes();
  const timeDecimal = hour + minute / 60;

  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const window = isWeekend ? AVAILABILITY.weekend : AVAILABILITY.weekday;

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour || 12;
  const displayMin = String(minute).padStart(2, '0');
  const istTimeStr = `${displayHour}:${displayMin} ${ampm} IST on ${dayNames[dayOfWeek]}`;

  const available = timeDecimal >= window.start && (timeDecimal + 0.5) <= window.end;

  return {
    available,
    istTimeStr,
    reason: available ? null : `${process.env.OWNER_FIRST_NAME} is available ${isWeekend ? '11AM–midnight' : '10AM–10PM'} IST on ${isWeekend ? 'weekends' : 'weekdays'}.`,
  };
}

/**
 * Creates a Google Calendar event with Google Meet, then emails the link
 * to both ${process.env.OWNER_FIRST_NAME} and the user (bypasses Domain-Wide Delegation restriction).
 */
async function scheduleGoogleMeet({ user_email, user_name, requested_datetime_iso }) {
  try {
    // 1. Check availability
    const { available, istTimeStr, reason } = checkAvailability(requested_datetime_iso);
    if (!available) {
      return { success: false, out_of_hours: true, requested_time: istTimeStr, message: `That time (${istTimeStr}) is outside ${process.env.OWNER_FIRST_NAME}'s available hours. ${reason}` };
    }

    // 2. Authenticate with OAuth2 using ${process.env.OWNER_FIRST_NAME}'s stored refresh token
    //    This allows conferenceData (Google Meet) to work on a personal Gmail account.
    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );
    oAuth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

    // 3. Build event with Google Meet conference
    const startTime = new Date(requested_datetime_iso);
    const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
    const senderName = user_name || 'Portfolio Visitor';

    const event = {
      summary: `📞 ${process.env.OWNER_FIRST_NAME} × ${senderName} — Portfolio Call`,
      description: [
        `30-minute portfolio inquiry call.`,
        `Guest: ${senderName} (${user_email})`,
        ``,
        `Scheduled via ${process.env.OWNER_FIRST_NAME}'s AI Portfolio Assistant.`,
      ].join('\n'),
      start: { dateTime: startTime.toISOString(), timeZone: 'Asia/Colombo' },
      end: { dateTime: endTime.toISOString(), timeZone: 'Asia/Colombo' },
      // No attendees field — send emails manually via nodemailer
      conferenceData: {
        createRequest: {
          requestId: `portfolio-meet-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 60 },
          { method: 'popup', minutes: 15 },
        ],
      },
    };

    // 4. Create event with conferenceDataVersion: 1 to generate a real Meet link
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
    const response = await calendar.events.insert({
      calendarId,
      resource: event,
      conferenceDataVersion: 1,
      sendUpdates: 'none',
    });

    const meetLink = response.data.conferenceData?.entryPoints?.find(
      (e) => e.entryPointType === 'video'
    )?.uri;

    const eventLink = response.data.htmlLink;
    console.log(`✅ Google Meet created: ${meetLink}`);
    console.log(`📅 Calendar event: ${eventLink}`);





    // 5. Send meeting emails via nodemailer (to both parties)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f9f9f9; border-radius: 12px;">
        <h2 style="color: #6d28d9;">📅 Google Meet Scheduled!</h2>
        <p style="color: #444;">A 30-minute call has been booked via ${process.env.OWNER_FIRST_NAME}'s AI Portfolio Assistant.</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
          <tr><td style="padding: 10px; font-weight: bold; color: #555; width: 130px;">Guest</td><td style="padding: 10px; color: #222;">${senderName} (${user_email})</td></tr>
          <tr style="background:#fff;"><td style="padding: 10px; font-weight: bold; color: #555;">Time</td><td style="padding: 10px; color: #222;">${istTimeStr}</td></tr>
          <tr><td style="padding: 10px; font-weight: bold; color: #555;">Duration</td><td style="padding: 10px; color: #222;">30 minutes</td></tr>
        </table>
        <div style="margin-top: 24px; text-align: center;">
          <a href="${meetLink}" style="display: inline-block; padding: 14px 28px; background: #6d28d9; color: #fff; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; margin-right: 12px;">
            🎥 Join Google Meet
          </a>
          <a href="${eventLink}" style="display: inline-block; padding: 14px 28px; background: #059669; color: #fff; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
            📅 View Calendar Event
          </a>
        </div>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">Sent by ${process.env.OWNER_FIRST_NAME}'s AI Portfolio Assistant</p>
      </div>
    `;

    await transporter.sendMail({
      from: `"${process.env.OWNER_FIRST_NAME}'s Portfolio Agent" <${process.env.EMAIL_USER}>`,
      to: OWNER_EMAIL,
      cc: user_email,
      subject: `📅 Google Meet Booked: ${senderName} — ${istTimeStr}`,
      html: emailHtml,
    });

    console.log(`✅ Meeting emails sent to ${OWNER_EMAIL} and ${user_email}`);

    return {
      success: true,
      meet_link: meetLink,
      event_link: eventLink,
      scheduled_time: istTimeStr,
      message: `Google Meet scheduled for ${istTimeStr}! Both you (${user_email}) and ${process.env.OWNER_FIRST_NAME} will receive an email with the join link: ${meetLink}`,
    };

  } catch (error) {
    console.error('❌ Google Calendar error:', error.message);
    return { success: false, message: `Failed to create the calendar event: ${error.message}` };
  }
}

module.exports = { scheduleGoogleMeet, checkAvailability };



