const frontendUrl = () => (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

export function hostDashboardUrl(roomCode) {
  return `${frontendUrl()}/room/${encodeURIComponent(roomCode)}`;
}

function layout({ title, bodyHtml }) {
  return `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 3px solid #0f172a;">
  <h1 style="margin: 0 0 16px; font-size: 22px; color: #0f172a;">SixSeven</h1>
  <h2 style="margin: 0 0 12px; font-size: 18px; color: #1e3a8a;">${title}</h2>
  ${bodyHtml}
  <p style="margin-top: 24px; padding-top: 12px; border-top: 2px solid #e2e8f0; font-size: 12px; color: #64748b;">
    Automated message from SixSeven Bill Splitter. Please do not reply to this email.
  </p>
</div>`;
}

export function memberPaymentSubmittedEmail({ roomCode, memberName, amount, proofUrl, dashboardUrl }) {
  const proofLink = proofUrl
    ? `<p><a href="${proofUrl}" style="color: #2563eb;">View payment screenshot</a></p>`
    : '';
  return {
    subject: `[SixSeven] ${memberName} submitted payment · Room ${roomCode}`,
    html: layout({
      title: 'Member payment received',
      bodyHtml: `
        <p><strong>${memberName}</strong> uploaded payment proof for room <strong>${roomCode}</strong>.</p>
        <p style="font-size: 18px; font-weight: bold;">Amount: RM ${amount}</p>
        ${proofLink}
        <p style="margin-top: 20px;">
          <a href="${dashboardUrl}" style="display: inline-block; padding: 12px 20px; background: #facc15; color: #0f172a; font-weight: bold; text-decoration: none; border: 2px solid #0f172a;">
            Open dashboard to verify
          </a>
        </p>
      `,
    }),
  };
}

export function overdueReminderEmail({ roomCode, dueDate, unpaidMembers, dashboardUrl }) {
  const list = unpaidMembers
    .map((m) => {
      const status =
        m.payment_status === 'PAID'
          ? '<span style="color:#d97706;">Paid — awaiting your verification</span>'
          : '<span style="color:#dc2626;">Unpaid</span>';
      return `<li><strong>${m.nickname}</strong>: RM ${m.amount} · ${status}</li>`;
    })
    .join('');

  return {
    subject: `[SixSeven] Payment overdue · Room ${roomCode}`,
    html: layout({
      title: 'Bill payment deadline passed',
      bodyHtml: `
        <p>Room <strong>${roomCode}</strong> was due on <strong>${dueDate}</strong>. The following members still need action:</p>
        <ul style="background: #f8fafc; padding: 16px 16px 16px 32px; line-height: 1.6;">${list}</ul>
        <p>
          <a href="${dashboardUrl}" style="display: inline-block; padding: 12px 20px; background: #facc15; color: #0f172a; font-weight: bold; text-decoration: none; border: 2px solid #0f172a;">
            Open host dashboard
          </a>
        </p>
      `,
    }),
  };
}
