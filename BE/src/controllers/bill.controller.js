import { supabaseAdmin } from '../config/supabase.js';
import { calculateBill } from '../services/calc.service.js';

/**
 * Configure split settings and payment methods.
 * POST /api/bills/config-split
 * Inputs: room_id, split_mode, payment_method_type, payment_method_detail, qr_code_file?
 */
export async function configSplit(req, res) {
  const { room_id, split_mode, payment_method_type, payment_method_detail } = req.body;
  const qrCodeFile = req.file;

  if (!room_id || !split_mode || !payment_method_type) {
    return res.status(400).json({ error: 'Missing required parameters: room_id, split_mode, payment_method_type' });
  }

  try {
    // 1. Confirm room exists
    const { data: room, error: roomError } = await supabaseAdmin
      .from('bill_rooms')
      .select('room_id')
      .eq('room_id', room_id)
      .maybeSingle();

    if (roomError || !room) {
      return res.status(404).json({ error: 'Room not found.' });
    }

    let qrCodeUrl = null;

    // 2. If a QR code is uploaded, save it to Storage bucket 'payment_methods'
    if (qrCodeFile) {
      await supabaseAdmin.storage.createBucket('payment_methods', { public: true }).catch(() => {
        // fail silently if bucket exists
      });
      
      const fileExt = qrCodeFile.originalname.split('.').pop();
      const fileName = `${room_id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from('payment_methods')
        .upload(fileName, qrCodeFile.buffer, {
          contentType: qrCodeFile.mimetype,
          upsert: true
        });

      if (uploadError) {
        console.error('[Bill Controller] QR Code upload failed:', uploadError);
        return res.status(500).json({ error: `QR Code upload failed: ${uploadError.message}` });
      }

      const { data: { publicUrl } } = supabaseAdmin.storage
        .from('payment_methods')
        .getPublicUrl(fileName);

      qrCodeUrl = publicUrl;
    }

    // 3. Update room details
    const updateData = {
      split_mode,
      payment_method_type,
      payment_method_detail
    };

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

    // 4. Trigger recalculation (split mode change dynamically recalcs amounts)
    await calculateBill(room_id);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Bill Controller] Config Split Exception:', error);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
}

/**
 * Perform high-concurrency safe food item assignment inside transactional PL/pgSQL database function.
 * POST /api/bills/assign-items
 * Inputs: room_id, user_id, selected_item_ids: []
 */
export async function assignItems(req, res) {
  const { room_id, user_id, selected_item_ids } = req.body;

  if (!room_id || !user_id || !Array.isArray(selected_item_ids)) {
    return res.status(400).json({ error: 'Missing required parameters: room_id, user_id, selected_item_ids' });
  }

  try {
    // Invoke transactional PL/pgSQL database function assign_items_and_calculate
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

    // Fetch the updated amount_to_pay for the user
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
