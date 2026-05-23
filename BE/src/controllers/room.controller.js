import { supabaseAdmin } from '../config/supabase.js';
import { generateRoomCode } from '../utils/helpers.js';
import { calculateBill } from '../services/calc.service.js';

/**
 * Host creates a room.
 * POST /api/rooms/create
 * Inputs: { due_date, nickname }
 */
export async function createRoom(req, res) {
  const { host_email, due_date, nickname } = req.body;
  const hostId = req.user.id; // from requireAuth middleware

  if (!host_email || !due_date) {
    return res.status(400).json({ error: 'Missing required parameters: host_email, due_date' });
  }

  try {
    // 1. Generate unique room code (handle potential collision)
    let roomCode = '';
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 5) {
      roomCode = generateRoomCode();
      const { data, error } = await supabaseAdmin
        .from('bill_rooms')
        .select('room_id')
        .eq('room_code', roomCode)
        .maybeSingle();

      if (!error && !data) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return res.status(500).json({ error: 'Failed to generate a unique room code. Please try again.' });
    }

    // 2. Upsert host profile in public users table
    const { error: userError } = await supabaseAdmin.from('users').upsert({
      user_id: hostId,
      nickname: nickname || 'Host',
      is_host: true
    });

    if (userError) {
      console.error('[Room Controller] Host profile upsert failed:', userError);
      return res.status(500).json({ error: `Failed to register host profile: ${userError.message}` });
    }

    // 3. Create the Bill Room
    const { data: room, error: roomError } = await supabaseAdmin
      .from('bill_rooms')
      .insert({
        room_code: roomCode,
        host_id: hostId,
        host_email: host_email.trim(),
        due_date: new Date(due_date).toISOString(),
        split_mode: 'EQUAL',
        status: 'ACTIVE'
      })
      .select()
      .single();

    if (roomError) {
      console.error('[Room Controller] Room creation failed:', roomError);
      return res.status(500).json({ error: `Failed to create room: ${roomError.message}` });
    }

    // 4. Bind Host as first participant in participant_bills (Host is verified by default)
    const { error: pbError } = await supabaseAdmin.from('participant_bills').insert({
      room_id: room.room_id,
      user_id: hostId,
      amount_to_pay: 0.00,
      payment_status: 'VERIFIED'
    });

    if (pbError) {
      console.error('[Room Controller] Failed to bind host as participant:', pbError);
      return res.status(500).json({ error: `Failed to register host participant bill: ${pbError.message}` });
    }

    return res.status(201).json({
      success: true,
      room_id: room.room_id,
      room_code: room.room_code,
      host_id: hostId
    });
  } catch (error) {
    console.error('[Room Controller] Create Room Exception:', error);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
}

/**
 * Member joins room.
 * POST /api/rooms/join
 * Inputs: { room_code, nickname }
 */
export async function joinRoom(req, res) {
  const { room_code, nickname } = req.body;
  const userId = req.user.id; // from requireAuth middleware

  if (!room_code || !nickname) {
    return res.status(400).json({ error: 'Missing required parameters: room_code, nickname' });
  }

  try {
    // 1. Locate the room
    const { data: room, error: roomError } = await supabaseAdmin
      .from('bill_rooms')
      .select('*')
      .eq('room_code', room_code.toUpperCase().trim())
      .maybeSingle();

    if (roomError || !room) {
      return res.status(404).json({ error: 'Room not found. Please verify the code.' });
    }

    if (room.status === 'COMPLETED') {
      return res.status(400).json({ error: 'This room has already been closed.' });
    }

    const isHost = room.host_id === userId;

    // 2. Upsert participant user profile
    const { error: userError } = await supabaseAdmin.from('users').upsert({
      user_id: userId,
      nickname: nickname.trim(),
      is_host: isHost
    });

    if (userError) {
      console.error('[Room Controller] Participant upsert failed:', userError);
      return res.status(500).json({ error: `Failed to register participant: ${userError.message}` });
    }

    // 3. Register user to room by creating record in participant_bills (Host is verified by default)
    const { error: pbError } = await supabaseAdmin.from('participant_bills').upsert({
      room_id: room.room_id,
      user_id: userId,
      amount_to_pay: 0.00,
      payment_status: isHost ? 'VERIFIED' : 'PENDING'
    }, {
      onConflict: 'room_id,user_id'
    });

    if (pbError) {
      console.error('[Room Controller] Participant binding failed:', pbError);
      return res.status(500).json({ error: `Failed to join room: ${pbError.message}` });
    }

    // 4. Trigger dynamic bill recalculation immediately (Equal mode re-split or item updates)
    await calculateBill(room.room_id);

    return res.status(200).json({
      success: true,
      room_id: room.room_id,
      user_id: userId
    });
  } catch (error) {
    console.error('[Room Controller] Join Room Exception:', error);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
}
