import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const emailHost = process.env.EMAIL_HOST;
const emailPort = parseInt(process.env.EMAIL_PORT || '2525', 10);
const emailUser = process.env.EMAIL_USER;
const emailPass = process.env.EMAIL_PASS;
const emailFrom = process.env.EMAIL_FROM || 'noreply@six7billsplitter.com';

const transporter = nodemailer.createTransport({
  host: emailHost,
  port: emailPort,
  secure: emailPort === 465, // true for 465, false for other ports
  auth: {
    user: emailUser,
    pass: emailPass
  }
});

/**
 * Sends an email notification to room hosts or members.
 * @param {Object} options - Email parameters
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - Email content in HTML format
 */
export async function sendEmail({ to, subject, html }) {
  if (!emailHost || !emailUser || !emailPass) {
    console.warn('Warning: Email SMTP configurations are missing. Skipping email sending.');
    return { skipped: true, message: 'SMTP not configured' };
  }

  const mailOptions = {
    from: emailFrom,
    to,
    subject,
    html
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Mailer] Email sent successfully: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('[Mailer] Error sending email:', error);
    throw error;
  }
}
