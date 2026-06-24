const { Resend } = require('resend');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeLead(body) {
  return {
    name: String(body.name || '').trim(),
    email: String(body.email || '').trim(),
    phone: String(body.phone || '').trim(),
    role: String(body.role || '').trim(),
    plan_interest: String(body.plan_interest || '').trim(),
    client_count: String(body.client_count || '').trim(),
    message: String(body.message || '').trim(),
    bot_field: String(body.bot_field || '').trim()
  };
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ ok: false, error: 'Method not allowed' })
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const lead = normalizeLead(body);

    // Honeypot spam protection.
    if (lead.bot_field) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ ok: true })
      };
    }

    if (!lead.name || !lead.email) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ ok: false, error: 'Name and email are required.' })
      };
    }

    if (!process.env.RESEND_API_KEY) {
      console.error('Missing RESEND_API_KEY environment variable.');
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ ok: false, error: 'Email service is not configured.' })
      };
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const notifyEmail = process.env.LEAD_NOTIFY_EMAIL || 'max.bosch00@gmail.com';
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'SetLinkAI Leads <onboarding@resend.dev>';

    const subject = `New SetLinkAI Early Access Request - ${lead.name}`;
    const text = [
      'New SetLinkAI Early Access Request',
      '',
      `Name: ${lead.name}`,
      `Email: ${lead.email}`,
      `Phone: ${lead.phone || 'Not provided'}`,
      `Role: ${lead.role || 'Not provided'}`,
      `Plan Interest: ${lead.plan_interest || 'Not provided'}`,
      `Client Count: ${lead.client_count || 'Not provided'}`,
      '',
      'Message / Goals:',
      lead.message || 'Not provided'
    ].join('\n');

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#111827;max-width:680px">
        <h2 style="margin:0 0 16px;color:#0B1026">New SetLinkAI Early Access Request</h2>
        <table cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;border:1px solid #e5e7eb">
          <tr><td style="font-weight:bold;background:#f9fafb;width:170px">Name</td><td>${escapeHtml(lead.name)}</td></tr>
          <tr><td style="font-weight:bold;background:#f9fafb">Email</td><td>${escapeHtml(lead.email)}</td></tr>
          <tr><td style="font-weight:bold;background:#f9fafb">Phone</td><td>${escapeHtml(lead.phone || 'Not provided')}</td></tr>
          <tr><td style="font-weight:bold;background:#f9fafb">Role</td><td>${escapeHtml(lead.role || 'Not provided')}</td></tr>
          <tr><td style="font-weight:bold;background:#f9fafb">Plan Interest</td><td>${escapeHtml(lead.plan_interest || 'Not provided')}</td></tr>
          <tr><td style="font-weight:bold;background:#f9fafb">Client Count</td><td>${escapeHtml(lead.client_count || 'Not provided')}</td></tr>
        </table>
        <h3 style="margin:22px 0 8px;color:#0B1026">Message / Goals</h3>
        <div style="white-space:pre-wrap;padding:14px;border:1px solid #e5e7eb;background:#f9fafb;border-radius:10px">${escapeHtml(lead.message || 'Not provided')}</div>
        <p style="font-size:12px;color:#6b7280;margin-top:18px">Reply directly to this email to respond to the lead.</p>
      </div>
    `;

    const emailResponse = await resend.emails.send({
      from: fromEmail,
      to: [notifyEmail],
      reply_to: lead.email,
      subject,
      text,
      html
    });

    if (emailResponse.error) {
      console.error('Resend error:', emailResponse.error);
      return {
        statusCode: 502,
        headers: corsHeaders,
        body: JSON.stringify({ ok: false, error: 'Email provider failed.' })
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ ok: true })
    };
  } catch (error) {
    console.error('Early access function error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ ok: false, error: 'Server error.' })
    };
  }
};
