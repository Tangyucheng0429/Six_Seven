import cron from 'node-cron';
import { supabaseAdmin } from '../config/supabase.js';
import { notifyHostOverdueRoomSafe } from './notify.service.js';

/**
 * Scans ACTIVE rooms past due_date and emails the host about unpaid members.
 */
export async function checkDueRoomsAndNotify() {
  console.log('[Cron Service] Starting due date sweep...');
  try {
    const now = new Date().toISOString();

    const { data: rooms, error: roomsError } = await supabaseAdmin
      .from('bill_rooms')
      .select('room_id, room_code, host_email, host_id, due_date')
      .eq('status', 'ACTIVE')
      .lte('due_date', now);

    if (roomsError) {
      console.error('[Cron Service] Error fetching overdue rooms:', roomsError);
      return;
    }

    if (!rooms?.length) {
      console.log('[Cron Service] No overdue active rooms found.');
      return;
    }

    console.log(`[Cron Service] Found ${rooms.length} overdue room(s).`);

    for (const room of rooms) {
      await notifyHostOverdueRoomSafe(room);
    }
  } catch (err) {
    console.error('[Cron Service] Exception in checkDueRoomsAndNotify:', err);
  }
}

export function initScheduler() {
  cron.schedule('0 * * * *', () => {
    checkDueRoomsAndNotify();
  });
  console.log('[Cron Service] Scheduler initialized (hourly due-date emails).');
}
