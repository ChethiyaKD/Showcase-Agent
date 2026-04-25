const nodemailer = require('nodemailer');
require('dotenv').config();

/**
 * Sends a contact email to Chethiya from a portfolio visitor.
 * @param {object} params
 * @param {string} params.user_email - The visitor's email address
 * @param {string} params.user_name  - The visitor's name (optional)
 * @param {string} params.requirement - A summary of their project/hiring need
 * @returns {object} { success: boolean, message: string }
 */
async function sendContactEmail({ user_email, user_name, requirement }) {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // Use a Gmail App Password
      },
    });

    const senderName = user_name || 'A portfolio visitor';
    const replyTo = user_email;

    const mailOptions = {
      from: `"Chethiya's Portfolio Agent" <${process.env.EMAIL_USER}>`,
      to: 'chethiyakdis@gmail.com',
      cc: user_email,
      replyTo: replyTo,
      subject: `📬 New Lead from Portfolio: ${senderName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f9f9f9; border-radius: 12px;">
          <h2 style="color: #6d28d9;">🚀 New Contact from Your Portfolio</h2>
          <p style="color: #444;">Someone reached out through your AI portfolio assistant.</p>

          <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
            <tr>
              <td style="padding: 10px; font-weight: bold; color: #555; width: 130px;">Name</td>
              <td style="padding: 10px; color: #222;">${senderName}</td>
            </tr>
            <tr style="background: #fff;">
              <td style="padding: 10px; font-weight: bold; color: #555;">Email</td>
              <td style="padding: 10px; color: #222;"><a href="mailto:${user_email}">${user_email}</a></td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: bold; color: #555; vertical-align: top;">Requirement</td>
              <td style="padding: 10px; color: #222; white-space: pre-wrap;">${requirement}</td>
            </tr>
          </table>

          <div style="margin-top: 24px; padding: 16px; background: #ede9fe; border-radius: 8px; color: #4c1d95;">
            <strong>Reply directly</strong> to this email to reach ${senderName} at ${user_email}.
          </div>

          <p style="color: #999; font-size: 12px; margin-top: 24px;">Sent by Chethiya's AI Portfolio Assistant</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Contact email sent for ${senderName} (${user_email})`);
    return { success: true, message: `Email sent successfully to Chethiya. He'll be in touch soon at ${user_email}!` };

  } catch (error) {
    console.error('❌ Email sending failed:', error.message);
    return { success: false, message: 'Failed to send the email. Please try again or contact Chethiya directly at chethiyakdis@gmail.com.' };
  }
}

module.exports = { sendContactEmail };
