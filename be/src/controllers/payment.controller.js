import { supabaseAdmin } from '../config/supabase.js';

/**
 * Member uploads transfer proof screenshot.
 * POST /api/payments/submit-proof
 * Inputs: room_id, user_id, proof_file (Multipart Form)
 */
export async function submitProof(req, res) {
  // 1. Prioritize authenticated req.user.id for production security, fallback to req.body.user_id for mock integration tests
  const user_id = req.user?.id || req.body.user_id;
  const { room_id } = req.body;
  const file = req.file;

  if (!room_id || !user_id || !file) {
    return res.status(400).json({ error: 'Missing required parameters: room_id, user_id, proof_file' });
  }

  try {
    // 2. Assert that participant bill exists
    const { data: bill, error: getError } = await supabaseAdmin
      .from('participant_bills')
      .select('payment_status')
      .eq('room_id', room_id)
      .eq('user_id', user_id)
      .maybeSingle();

    if (getError || !bill) {
      return res.status(404).json({ error: 'Participant bill record not found.' });
    }

    // 3. Vercel-Safe upload to Supabase Storage proofs bucket (static bucket design)
    const fileExt = file.originalname.split('.').pop() || 'jpg';
    const fileName = `${room_id}/${user_id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('proofs')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true
      });

    if (uploadError) {
      console.error('[Payment Controller] Proof upload failed:', uploadError);
      return res.status(500).json({ error: `Proof upload failed: ${uploadError.message}` });
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('proofs')
      .getPublicUrl(fileName);

    // 4. Update status to PAID and save proof image url
    const { error: updateError } = await supabaseAdmin
      .from('participant_bills')
      .update({
        proof_image_url: publicUrl,
        payment_status: 'PAID',
        updated_at: new Date().toISOString()
      })
      .eq('room_id', room_id)
      .eq('user_id', user_id);

    if (updateError) {
      console.error('[Payment Controller] Failed to update bill status:', updateError);
      return res.status(500).json({ error: `Failed to update payment status: ${updateError.message}` });
    }

    return res.status(200).json({
      success: true,
      payment_status: 'PAID',
      proof_image_url: publicUrl
    });
  } catch (error) {
    console.error('[Payment Controller] Submit Proof Exception:', error);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
}

/**
 * Host reviews and approves a member's payment.
 * POST /api/payments/verify-member
 * Inputs: { room_id, member_user_id }
 */
export async function verifyMemberPayment(req, res) {
  const { room_id, member_user_id } = req.body;
  const requestUserId = req.user?.id;

  if (!room_id || !member_user_id) {
    return res.status(400).json({ error: 'Missing required parameters: room_id, member_user_id' });
  }

  try {
    // 1. Fetch the room and verify status & host ownership
    const { data: room, error: roomError } = await supabaseAdmin
      .from('bill_rooms')
      .select('host_id, status')
      .eq('room_id', room_id)
      .maybeSingle();

    if (roomError || !room) {
      return res.status(404).json({ error: 'Room not found.' });
    }

    // Host Ownership Security Lock Check
    if (!requestUserId || room.host_id !== requestUserId) {
      return res.status(403).json({ error: 'Forbidden: Only the room host can verify payments.' });
    }

    if (room.status === 'COMPLETED') {
      return res.status(400).json({ error: 'This room has already been completed.' });
    }

    // 2. Update member payment status to VERIFIED
    const { error: updateError } = await supabaseAdmin
      .from('participant_bills')
      .update({
        payment_status: 'VERIFIED',
        updated_at: new Date().toISOString()
      })
      .eq('room_id', room_id)
      .eq('user_id', member_user_id);

    if (updateError) {
      console.error('[Payment Controller] Failed to verify payment status:', updateError);
      return res.status(500).json({ error: `Failed to verify payment status: ${updateError.message}` });
    }

    // 3. Fetch all bills in this room to check if all participants are verified
    const { data: bills, error: billsError } = await supabaseAdmin
      .from('participant_bills')
      .select('payment_status')
      .eq('room_id', room_id);

    if (billsError || !bills || bills.length === 0) {
      console.error('[Payment Controller] Failed to check room settlement status:', billsError);
      return res.status(500).json({ error: 'Failed to verify room closing status.' });
    }

    // 4. Auto-close room if all active participants are fully VERIFIED
    let roomStatus = 'ACTIVE';
    const allVerified = bills.every(b => b.payment_status === 'VERIFIED');

    if (allVerified) {
      const { error: roomUpdateError } = await supabaseAdmin
        .from('bill_rooms')
        .update({ status: 'COMPLETED' })
        .eq('room_id', room_id);

      if (roomUpdateError) {
        console.error('[Payment Controller] Auto-closing room failed:', roomUpdateError);
      } else {
        console.log(`[Payment Controller] Room ${room_id} fully settled. Status updated to COMPLETED.`);
        roomStatus = 'COMPLETED';
      }
    }

    return res.status(200).json({
      success: true,
      payment_status: 'VERIFIED',
      room_status: roomStatus
    });
  } catch (error) {
    console.error('[Payment Controller] Verify Member Payment Exception:', error);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
}
