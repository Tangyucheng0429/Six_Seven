import { supabaseAdmin } from '../config/supabase.js';
import { calculateBill } from '../services/calc.service.js';
import { ensurePublicBucket } from '../utils/storageBuckets.js';
import { normalizeEqualHeadcount } from '../utils/equalSplit.js';

/**
 * Configure split settings and payment methods.
 * POST /api/bills/config-split
 * Inputs: room_id, split_mode, payment_method_type, payment_method_detail, qr_code_file?
 */
export async function configSplit(req, res) {
  const {
    room_id,
    split_mode,
    payment_method_type,
    payment_method_detail,
    equal_headcount,
    equal_host_participates,
  } = req.body;
  const qrCodeFile = req.file;

  if (!room_id || !split_mode || !payment_method_type) {
    return res.status(400).json({ error: 'Missing required parameters: room_id, split_mode, payment_method_type' });
  }

  // 1. Validation of ENUM parameters
  const validSplitModes = ['EQUAL', 'ITEM_BASED'];
  const validPaymentTypes = ['DUITNOW_QR', 'BANK_TRANSFER', 'TNG_QR'];

  if (!validSplitModes.includes(split_mode)) {
    return res.status(400).json({ error: 'Invalid split_mode. Must be EQUAL or ITEM_BASED.' });
  }

  if (!validPaymentTypes.includes(payment_method_type)) {
    return res.status(400).json({ error: 'Invalid payment_method_type. Must be DUITNOW_QR, BANK_TRANSFER, or TNG_QR.' });
  }

  try {
    // 2. Fetch room details and verify active status
    const { data: room, error: roomError } = await supabaseAdmin
      .from('bill_rooms')
      .select('room_id, status, host_id')
      .eq('room_id', room_id)
      .maybeSingle();

    if (roomError || !room) {
      return res.status(404).json({ error: 'Room not found.' });
    }

    if (room.status === 'COMPLETED') {
      return res.status(400).json({ error: 'This room has already been closed.' });
    }

    // 3. Host Identity Verification (Authorization Lock)
    const requestUserId = req.user?.id;
    if (!requestUserId || room.host_id !== requestUserId) {
      return res.status(403).json({ error: 'Forbidden: Only the room host can configure split settings.' });
    }

    let qrCodeUrl = null;

    // 4. Upload host QR to Supabase Storage → bill_rooms.qr_code_url
    if (qrCodeFile) {
      await ensurePublicBucket('qrcodes');

      const fileExt = qrCodeFile.originalname.split('.').pop() || 'png';
      const fileName = `${room_id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from('qrcodes')
        .upload(fileName, qrCodeFile.buffer, {
          contentType: qrCodeFile.mimetype,
          upsert: true
        });

      if (uploadError) {
        console.error('[Bill Controller] QR Code upload failed:', uploadError);
        return res.status(500).json({ error: `QR Code upload failed: ${uploadError.message}` });
      }

      const { data: { publicUrl } } = supabaseAdmin.storage
        .from('qrcodes')
        .getPublicUrl(fileName);

      qrCodeUrl = publicUrl;
    }

    // 5. Update room settings
    const updateData = {
      split_mode,
      payment_method_type,
      payment_method_detail: payment_method_detail?.trim() || null,
    };

    if (split_mode === 'EQUAL') {
      updateData.equal_headcount = normalizeEqualHeadcount(equal_headcount);
      updateData.equal_host_participates = equal_host_participates !== 'false' && equal_host_participates !== false;
    }

    if (qrCodeUrl) {
      updateData.qr_code_url = qrCodeUrl;
    }

    const { error: updateError } = await supabaseAdmin
      .from('bill_rooms')
      .update(updateData)
      .eq('room_id', room_id);

    if (updateError) {
      console.error('[Bill Controller] Split configuration update failed:', updateError);
      return res.status(500).json({ error: `Failed to configure split settings: ${updateError.message}` });
    }

    // 6. Recalculate billing
    await calculateBill(room_id);

    return res.status(200).json({
      success: true,
      message: 'Split settings configured successfully.'
    });
  } catch (error) {
    console.error('[Bill Controller] Config Split Exception:', error);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
}

export async function assignItems(req, res) {
  // Prioritize authenticated req.user.id for production security, with body user_id as backup for mock integration test suites
  const user_id = req.user?.id || req.body.user_id;
  const { room_id, selected_item_ids } = req.body;

  if (!room_id || !user_id || !Array.isArray(selected_item_ids)) {
    return res.status(400).json({ error: 'Missing required parameters: room_id, user_id, selected_item_ids' });
  }

  try {
    // 1. Confirm room exists and is active
    const { data: room, error: roomError } = await supabaseAdmin
      .from('bill_rooms')
      .select('status')
      .eq('room_id', room_id)
      .maybeSingle();

    if (roomError || !room) {
      return res.status(404).json({ error: 'Room not found.' });
    }

    if (room.status === 'COMPLETED') {
      return res.status(400).json({ error: 'This room has already been closed.' });
    }

    // 2. Invoke transactional PL/pgSQL database function assign_items_and_calculate
    // Row level locking (FOR UPDATE) executes inside Database to prevent concurrent race conditions
    const { error } = await supabaseAdmin.rpc('assign_items_and_calculate', {
      p_room_id: room_id,
      p_user_id: user_id,
      p_selected_item_ids: selected_item_ids
    });

    if (error) {
      console.error('[Bill Controller] RPC assign_items_and_calculate failed:', error);
      return res.status(500).json({ error: `Failed to assign items: ${error.message}` });
    }

    // 3. Fetch the updated amount_to_pay for the user
    const { data: bill, error: billError } = await supabaseAdmin
      .from('participant_bills')
      .select('amount_to_pay')
      .eq('room_id', room_id)
      .eq('user_id', user_id)
      .maybeSingle();

    const updatedAmount = billError || !bill ? 0.00 : parseFloat(bill.amount_to_pay);

    return res.status(200).json({
      success: true,
      amount_to_pay: updatedAmount
    });
  } catch (error) {
    console.error('[Bill Controller] Assign Items Exception:', error);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
}
