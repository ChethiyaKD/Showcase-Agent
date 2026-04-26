const nodemailer = require('nodemailer');
require('dotenv').config();

/**
 * Sends a contact email to the owner of the portfolio from a visitor.
 * @param {object} params
 * @param {string} params.user_email - The visitor's email address
 * @param {string} params.user_name  - The visitor's name (optional)
 * @param {string} params.requirement - A summary of their project/hiring need
 * @param {number} params.lead_score - AI determined score 1-10
 * @param {string} params.lead_category - AI determined category (Founder, Recruiter, etc)
 * @returns {object} { success: boolean, message: string }
 */
async function sendContactEmail({ user_email, user_name, requirement, lead_score, lead_category }) {
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
      from: `"${process.env.OWNER_FIRST_NAME.toUpperCase()}'s Portfolio Agent" <${process.env.EMAIL_USER}>`,
      to: process.env.OWNER_EMAIL,
      cc: user_email,
      replyTo: replyTo,
      subject: `🚀 ${lead_category || 'New Lead'}: ${senderName} (${lead_score || '?'}/10)`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px;">
          <h2 style="color: #4f46e5; margin-top: 0; font-size: 24px;">New Lead Intelligence</h2>
          
          <div style="display: flex; gap: 12px; margin-bottom: 24px;">
            <div style="background: #f5f3ff; padding: 12px 20px; border-radius: 12px; border: 1px solid #ddd6fe;">
              <div style="color: #6d28d9; font-size: 10px; font-weight: bold; text-transform: uppercase;">Lead Score</div>
              <div style="color: #4c1d95; font-size: 18px; font-weight: bold;">${lead_score || 'N/A'}/10</div>
            </div>
            <div style="background: #f0fdf4; padding: 12px 20px; border-radius: 12px; border: 1px solid #bbf7d0;">
              <div style="color: #166534; font-size: 10px; font-weight: bold; text-transform: uppercase;">Category</div>
              <div style="color: #14532d; font-size: 18px; font-weight: bold;">${lead_category || 'General'}</div>
            </div>
          </div>

          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6; color: #6b7280; width: 100px;">Name</td>
              <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6; color: #111827; font-weight: 500;">${senderName}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6; color: #6b7280;">Email</td>
              <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6; color: #111827; font-weight: 500;">${user_email}</td>
            </tr>
          </table>

          <div style="margin-top: 24px;">
            <div style="color: #6b7280; font-size: 10px; font-weight: bold; text-transform: uppercase; margin-bottom: 8px;">Visitor Requirement</div>
            <div style="background: #f9fafb; padding: 16px; border-radius: 12px; color: #374151; line-height: 1.6; border-left: 4px solid #4f46e5;">
              ${requirement.replace(/\n/g, '<br>')}
            </div>
          </div>

          <p style="color: #9ca3af; font-size: 12px; margin-top: 32px; text-align: center;">
            This lead was qualified by your AI Portfolio Assistant.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Contact email sent for ${senderName} (${user_email})`);
    return { success: true, message: `Email sent successfully to ${process.env.OWNER_FIRST_NAME}. He'll be in touch soon at ${user_email}!` };

  } catch (error) {
    console.error('❌ Email sending failed:', error.message);
    return { success: false, message: `Failed to send the email. Please try again or contact ${process.env.OWNER_FIRST_NAME} directly at ${process.env.OWNER_EMAIL}.` };
  }
}

module.exports = { sendContactEmail };
