import { supabaseAdmin } from '../config/supabase.js';
import { sendEmail } from '../utils/mailer.js';
import {
  hostDashboardUrl,
  memberPaymentSubmittedEmail,
  overdueReminderEmail,
} from '../utils/emailTemplates.js';
import { shouldNotify, markNotified } from '../utils/notifyDedupe.js';

const OVERDUE_COOLDOWN_MS = 23 * 60 * 60 * 1000;

/**
 * Email host when a member uploads payment proof.
 */
export async function notifyHostMemberPaymentSubmitted(roomId, memberUserId) {
  const { data: room, error: roomError } = await supabaseAdmin
    .from('bill_rooms')
    .select('room_id, room_code, host_email, host_id')
    .eq('room_id', roomId)
    .maybeSingle();

  if (roomError || !room) {
    console.error('[Notify] Room not found for payment notification:', roomError);
    return;
  }

  if (memberUserId === room.host_id) return;

  const { data: bill, error: billError } = await supabaseAdmin
    .from('participant_bills')
    .select('amount_to_pay, proof_image_url, payment_status')
    .eq('room_id', roomId)
    .eq('user_id', memberUserId)
    .maybeSingle();

  if (billError || !bill) {
    console.error('[Notify] Bill not found:', billError);
    return;
  }

  const { data: memberUser } = await supabaseAdmin
    .from('users')
    .select('nickname, is_host')
    .eq('user_id', memberUserId)
    .maybeSingle();

  if (memberUser?.is_host) return;

  const memberName = memberUser?.nickname || 'A member';
  const amount = Number(bill.amount_to_pay).toFixed(2);
  const dashboardUrl = hostDashboardUrl(room.room_code);
  const { subject, html } = memberPaymentSubmittedEmail({
    roomCode: room.room_code,
    memberName,
    amount,
    proofUrl: bill.proof_image_url,
    dashboardUrl,
  });

  await sendEmail({ to: room.host_email, subject, html });
}

export async function notifyHostMemberPaymentSubmittedSafe(roomId, memberUserId) {
  try {
    await notifyHostMemberPaymentSubmitted(roomId, memberUserId);
  } catch (err) {
    console.error('[Notify] Failed to email host about payment:', err.message || err);
  }
}

/**
 * Email host when due date passed and members are still unpaid / unverified.
 * @returns {boolean} true if email was sent
 */
export async function notifyHostOverdueRoom(room) {
  const dedupeKey = `overdue:${room.room_id}`;
  if (!shouldNotify(dedupeKey, OVERDUE_COOLDOWN_MS)) {
    return false;
  }

  const { data: bills, error: billsError } = await supabaseAdmin
    .from('participant_bills')
    .select(`
      amount_to_pay,
      payment_status,
      user_id,
      users ( nickname )
    `)
    .eq('room_id', room.room_id);

  if (billsError || !bills?.length) {
    console.error('[Notify] Bills fetch failed for overdue:', billsError);
    return false;
  }

  const unpaidMembers = bills
    .filter((b) => b.user_id !== room.host_id)
    .filter((b) => b.payment_status === 'PENDING' || b.payment_status === 'PAID')
    .map((b) => ({
      nickname: b.users?.nickname || 'Member',
      amount: Number(b.amount_to_pay).toFixed(2),
      payment_status: b.payment_status,
    }));

  if (unpaidMembers.length === 0) {
    await supabaseAdmin
      .from('bill_rooms')
      .update({ status: 'COMPLETED' })
      .eq('room_id', room.room_id);
    return false;
  }

  const dueDate = new Date(room.due_date).toLocaleString('en-MY', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const dashboardUrl = hostDashboardUrl(room.room_code);
  const { subject, html } = overdueReminderEmail({
    roomCode: room.room_code,
    dueDate,
    unpaidMembers,
    dashboardUrl,
  });

  await sendEmail({ to: room.host_email, subject, html });
  markNotified(dedupeKey);
  return true;
}

export async function notifyHostOverdueRoomSafe(room) {
  try {
    return await notifyHostOverdueRoom(room);
  } catch (err) {
    console.error(`[Notify] Overdue email failed for ${room.room_code}:`, err.message || err);
    return false;
  }
}
