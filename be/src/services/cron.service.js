import cron from 'node-cron';
import { supabaseAdmin } from '../config/supabase.js';
import { sendEmail } from '../utils/mailer.js';

/**
 * Scans all ACTIVE rooms where due_date <= CURRENT_TIMESTAMP,
 * gathers information on unpaid members (PENDING or PAID status),
 * and dispatches a comprehensive email reminder to the host.
 */
export async function checkDueRoomsAndNotify() {
  console.log('[Cron Service] Starting due date sweep...');
  try {
    const now = new Date().toISOString();

    // 1. Fetch all active and overdue rooms
    const { data: rooms, error: roomsError } = await supabaseAdmin
      .from('bill_rooms')
      .select('room_id, room_code, host_email, host_id, due_date')
      .eq('status', 'ACTIVE')
      .lte('due_date', now);

    if (roomsError) {
      console.error('[Cron Service] Error fetching overdue rooms:', roomsError);
      return;
    }

    if (!rooms || rooms.length === 0) {
      console.log('[Cron Service] No overdue active rooms found.');
      return;
    }

    console.log(`[Cron Service] Found ${rooms.length} overdue rooms. Checking outstanding balances...`);

    // 2. Iterate through each room and check participant status
    for (const room of rooms) {
      // Get all participant bills for the room
      const { data: bills, error: billsError } = await supabaseAdmin
        .from('participant_bills')
        .select(`
          amount_to_pay,
          payment_status,
          user_id,
          users (
            nickname
          )
        `)
        .eq('room_id', room.room_id);

      if (billsError) {
        console.error(`[Cron Service] Error fetching bills for room ${room.room_code}:`, billsError);
        continue;
      }

      if (!bills || bills.length === 0) {
        continue;
      }

      // Filter outstanding participants: those who have not paid (PENDING) or paid but unverified (PAID)
      const unpaidMembers = bills.filter(
        b => b.payment_status === 'PENDING' || b.payment_status === 'PAID'
      );

      // If everyone is already fully VERIFIED, auto-close the room and skip notification
      if (unpaidMembers.length === 0) {
        console.log(`[Cron Service] Room ${room.room_code} is fully settled. Auto-completing room...`);
        await supabaseAdmin
          .from('bill_rooms')
          .update({ status: 'COMPLETED' })
          .eq('room_id', room.room_id);
        continue;
      }

      // 3. Construct a beautiful transactional email for the Host
      console.log(`[Cron Service] Room ${room.room_code} has ${unpaidMembers.length} unpaid participants. Sending email to ${room.host_email}...`);

      const membersListHtml = unpaidMembers
        .map(member => {
          const nickname = member.users?.nickname || 'Anonymous Member';
          const statusLabel = member.payment_status === 'PAID' 
            ? '<span style="color:#d97706; font-weight:bold;">[Paid, Awaiting Verification]</span>' 
            : '<span style="color:#dc2626; font-weight:bold;">[Unpaid]</span>';
          return `<li><strong>${nickname}</strong>: RM ${parseFloat(member.amount_to_pay).toFixed(2)} ${statusLabel}</li>`;
        })
        .join('');

      const emailSubject = `🚨 Bill Splitting Reminder: Room Code [${room.room_code}] has Outstanding Payments`;
      
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #1e3a8a; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">Six 7 Bill Splitter Reminder</h2>
          <p>Hi Host,</p>
          <p>Your bill room with invitation code <strong style="font-size: 1.1em; color: #2563eb;">${room.room_code}</strong> has passed its payment deadline (Due: ${new Date(room.due_date).toLocaleString()}).</p>
          
          <p>The following participants still have outstanding actions:</p>
          <ul style="background-color: #f8fafc; padding: 15px 15px 15px 30px; border-radius: 6px; line-height: 1.6;">
            ${membersListHtml}
          </ul>

          <p>Please log in to your dashboard to review payment screenshot proofs or send a manual reminder to these participants.</p>
          
          <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e2e8f0; font-size: 0.85em; color: #64748b;">
            This is an automated system notification from the <strong>Six 7 Bill Splitter System</strong>. Please do not reply directly to this email.
          </div>
        </div>
      `;

      try {
        await sendEmail({
          to: room.host_email,
          subject: emailSubject,
          html: emailHtml
        });
      } catch (err) {
        console.error(`[Cron Service] Failed to send email to ${room.host_email}:`, err);
      }
    }
  } catch (err) {
    console.error('[Cron Service] Exception in checkDueRoomsAndNotify:', err);
  }
}

// 4. Initialize scheduling: Runs every hour on the hour
export function initScheduler() {
  // Cron pattern: '0 * * * *' (Every hour)
  // For development testing, you can change this, but standard is every hour.
  cron.schedule('0 * * * *', () => {
    checkDueRoomsAndNotify();
  });
  console.log('[Cron Service] Scheduler successfully initialized (runs hourly).');
}
