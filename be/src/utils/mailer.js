import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const resendKey = process.env.RESEND_API_KEY;
const resend = resendKey ? new Resend(resendKey) : null;

const RESEND_TEST_FROM = 'SixSeven <onboarding@resend.dev>';

const emailHost = process.env.EMAIL_HOST;
const emailPort = parseInt(process.env.EMAIL_PORT || '2525', 10);
const emailUser = process.env.EMAIL_USER;
const emailPass = process.env.EMAIL_PASS;

const smtpTransporter =
  emailHost && emailUser && emailPass
    ? nodemailer.createTransport({
        host: emailHost,
        port: emailPort,
        secure: emailPort === 465,
        auth: { user: emailUser, pass: emailPass },
      })
    : null;

function useVerifiedCustomFrom() {
  return process.env.RESEND_USE_VERIFIED_DOMAIN === 'true' && Boolean(process.env.EMAIL_FROM?.trim());
}

function resolveFromAddress() {
  if (resend && !useVerifiedCustomFrom()) {
    return RESEND_TEST_FROM;
  }
  return (
    process.env.EMAIL_FROM?.trim() ||
    (resend ? RESEND_TEST_FROM : 'noreply@six7billsplitter.com')
  );
}

/** Resend test mode only delivers to RESEND_SANDBOX_TO until a domain is verified. */
function resolveRecipient(intendedTo) {
  const to = String(intendedTo || '').trim();
  if (!to) return to;

  if (!resend || useVerifiedCustomFrom()) {
    return to;
  }

  const sandboxTo = process.env.RESEND_SANDBOX_TO?.trim();
  if (!sandboxTo) {
    throw new Error(
      'RESEND_SANDBOX_TO is required in be/.env until a custom domain is verified on Resend.',
    );
  }

  if (to.toLowerCase() === sandboxTo.toLowerCase()) {
    return to;
  }

  return sandboxTo;
}

export async function sendEmail({ to, subject, html }) {
  if (!to || !subject || !html) {
    throw new Error('sendEmail requires to, subject, and html');
  }

  const from = resolveFromAddress();
  const deliverTo = resolveRecipient(to);

  if (resend) {
    const { data, error } = await resend.emails.send({
      from,
      to: [deliverTo],
      subject,
      html,
    });
    if (error) {
      console.error('[Mailer] Resend error:', error);
      throw error;
    }
    return data;
  }

  if (smtpTransporter) {
    return smtpTransporter.sendMail({
      from,
      to: deliverTo,
      subject,
      html,
    });
  }

  console.warn('[Mailer] No RESEND_API_KEY or SMTP configured — email skipped.');
  return { skipped: true };
}

export function isEmailConfigured() {
  return Boolean(resend || smtpTransporter);
}
