import { supabaseAdmin } from '../config/supabase.js';

/**
 * Triggers the dynamic bill calculation for a room.
 * Invokes the database transactional PL/pgSQL function calculate_bill_room which
 * locks the room, processes either EQUAL or ITEM_BASED split patterns,
 * and perfectly balances rounding errors (Malaysian sen mismatch) using subtraction-based host/absorber gap adjustment.
 * @param {string} roomId - The UUID of the room to calculate.
 */
export async function calculateBill(roomId) {
  try {
    console.log(`[Calc Service] Triggering calculation for room: ${roomId}`);
    const { error } = await supabaseAdmin.rpc('calculate_bill_room', {
      p_room_id: roomId
    });

    if (error) {
      throw error;
    }

    console.log(`[Calc Service] Bill successfully calculated for room ${roomId}`);
    return true;
  } catch (error) {
    console.error(`[Calc Service] Failed calculating bill for room ${roomId}:`, error);
    throw error;
  }
}
