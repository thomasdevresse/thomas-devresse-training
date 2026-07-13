const nodemailer = require('nodemailer');

const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'thom.devresse@gmail.com';
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || process.env.GMAIL_USER || 'notifications@devresse.fit';

let resendClient;
let smtpClient;

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendClient) {
    const { Resend } = require('resend');
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

function getSmtp() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return null;
  if (!smtpClient) {
    smtpClient = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
  }
  return smtpClient;
}

async function notifyContact(msg) {
  const safe = {
    name: escapeHtml(msg.name),
    email: escapeHtml(msg.email),
    phone: escapeHtml(msg.phone),
    subject: escapeHtml(msg.subject),
    message: escapeHtml(msg.message),
  };
  const subject = `Coaching application: ${msg.subject || 'Website contact'} — from ${msg.name}`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#a54432;color:#fff;padding:20px 24px"><h2 style="margin:0;font-size:18px">New coaching application</h2></div>
      <div style="background:#171614;color:#e9e0d3;padding:24px">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px 0;color:#aaa;width:120px">From</td><td style="padding:8px 0;font-weight:700">${safe.name}</td></tr>
          <tr><td style="padding:8px 0;color:#aaa">Email</td><td style="padding:8px 0"><a href="mailto:${safe.email}" style="color:#df806b">${safe.email}</a></td></tr>
          ${safe.phone ? `<tr><td style="padding:8px 0;color:#aaa">Phone</td><td style="padding:8px 0">${safe.phone}</td></tr>` : ''}
          <tr><td style="padding:8px 0;color:#aaa">Subject</td><td style="padding:8px 0">${safe.subject}</td></tr>
        </table>
        <div style="margin-top:16px;padding:16px;background:#0c0c0b;border-left:3px solid #a54432;line-height:1.6">${safe.message.replace(/\n/g, '<br>')}</div>
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid #333"><a href="mailto:${safe.email}" style="color:#df806b;text-decoration:none;font-weight:700">Reply to ${safe.name}</a></div>
      </div>
    </div>`;

  const resend = getResend();
  if (resend) {
    return resend.emails.send({
      from: `Devresse Training <${FROM_EMAIL}>`,
      to: [NOTIFY_EMAIL],
      subject,
      html,
      replyTo: msg.email,
    });
  }

  const smtp = getSmtp();
  if (smtp) {
    await smtp.sendMail({
      from: `Devresse Training <${process.env.GMAIL_USER}>`,
      to: NOTIFY_EMAIL,
      subject,
      html,
      replyTo: msg.email,
    });
    return { ok: true };
  }

  return null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BODY_BYTES = 32 * 1024;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 8;
const recentRequests = new Map();

function clean(value, max) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, max);
}

function cleanHeader(value, max) {
  return clean(value, max).replace(/[\r\n]+/g, ' ');
}

function isRateLimited(ip) {
  const now = Date.now();
  const requests = (recentRequests.get(ip) || []).filter((time) => now - time < RATE_WINDOW_MS);
  requests.push(now);
  recentRequests.set(ip, requests);
  if (recentRequests.size > 500) {
    for (const [key, times] of recentRequests) {
      if (!times.some((time) => now - time < RATE_WINDOW_MS)) recentRequests.delete(key);
    }
  }
  return requests.length > RATE_LIMIT;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const contentLength = Number(req.headers['content-length'] || 0);
  if (contentLength > MAX_BODY_BYTES) return res.status(413).json({ error: 'Request too large' });
  if (Buffer.byteLength(JSON.stringify(req.body || {}), 'utf8') > MAX_BODY_BYTES) {
    return res.status(413).json({ error: 'Request too large' });
  }

  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  if (isRateLimited(ip)) return res.status(429).json({ error: 'Too many requests. Please try again later.' });

  const origin = req.headers.origin;
  const host = req.headers.host;
  if (origin) {
    try {
      if (new URL(origin).host !== host) return res.status(403).json({ error: 'Origin not allowed' });
    } catch {
      return res.status(403).json({ error: 'Origin not allowed' });
    }
  }

  const body = req.body || {};
  if (clean(body.website, 200)) return res.status(200).json({ ok: true });

  const message = {
    name: cleanHeader(body.name, 100),
    email: clean(body.email, 160).toLowerCase(),
    phone: clean(body.phone, 40),
    subject: cleanHeader(body.subject, 160) || 'Coaching application',
    message: clean(body.message, 6000)
  };

  if (!message.name || !EMAIL_RE.test(message.email) || message.message.length < 20 || body.consent !== true) {
    return res.status(400).json({ error: 'Please provide a valid name, email and diagnostic.' });
  }

  try {
    const sent = await notifyContact(message);
    if (!sent) return res.status(503).json({ error: 'Email delivery is not configured yet.' });
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[Contact] Delivery failed:', error?.message || error);
    return res.status(500).json({ error: 'The diagnostic could not be delivered.' });
  }
};
