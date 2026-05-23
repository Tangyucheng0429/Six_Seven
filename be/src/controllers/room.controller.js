import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../config/supabase.js';
import { generateRoomCode } from '../utils/helpers.js';
import { calculateBill } from '../services/calc.service.js';

/**
 * Host creates a room.
 * POST /api/rooms/create
 * Inputs: { due_date, nickname }
 */
/**
 * Helper to manually parse a specific cookie from request headers.
 */
function getCookie(req, name) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const parts = cookie.split('=');
    const key = parts[0]?.trim();
    const val = parts.slice(1).join('=')?.trim();
    if (key) acc[key] = decodeURIComponent(val);
    return acc;
  }, {});
  return cookies[name] || null;
}

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

/** Resolve Bearer, cookie, or create a new anonymous Supabase user. */
async function resolveUserId(req, nickname = 'Guest') {
  if (req.user?.id) return req.user.id;

  if (req.headers.authorization?.startsWith('Bearer ')) {
    const token = req.headers.authorization.split(' ')[1];
    try {
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && user) return user.id;
    } catch (err) {
      console.error('[Room Controller] Bearer token retrieval failed:', err);
    }
  }

  const cookieUserId = getCookie(req, 'host_id') || getCookie(req, 'user_id');
  if (cookieUserId) return cookieUserId;

  const authEmail = `guest-${randomUUID()}@sixseven.local`;
  const { data: { user: newAuthUser }, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
    email: authEmail,
    email_confirm: true,
    user_metadata: { nickname: nickname || 'Guest' },
  });

  if (createAuthError || !newAuthUser) {
    throw new Error(`Failed to create session: ${createAuthError?.message || 'Unknown'}`);
  }
  return newAuthUser.id;
}

async function buildRoomPayload(roomId) {
  const { data: room } = await supabaseAdmin
    .from('bill_rooms')
    .select('*')
    .eq('room_id', roomId)
    .maybeSingle();

  if (!room) return null;

  const { data: host } = await supabaseAdmin
    .from('users')
    .select('user_id, nickname')
    .eq('user_id', room.host_id)
    .maybeSingle();

  const { data: receipt } = await supabaseAdmin
    .from('receipts')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let items = [];
  let assignments = [];

  if (receipt?.receipt_id) {
    const { data: receiptItems } = await supabaseAdmin
      .from('receipt_items')
      .select('*')
      .eq('receipt_id', receipt.receipt_id);

    items = receiptItems || [];

    const itemIds = items.map((i) => i.item_id);
    if (itemIds.length > 0) {
      const { data: assignmentRows } = await supabaseAdmin
        .from('item_assignments')
        .select('item_id, user_id')
        .in('item_id', itemIds);

      assignments = assignmentRows || [];
    }
  }

  const { data: participantBills } = await supabaseAdmin
    .from('participant_bills')
    .select('user_id, amount_to_pay, payment_status, proof_image_url')
    .eq('room_id', roomId);

  const userIds = [...new Set((participantBills || []).map((p) => p.user_id))];
  let usersById = {};

  if (userIds.length > 0) {
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('user_id, nickname')
      .in('user_id', userIds);

    usersById = Object.fromEntries((users || []).map((u) => [u.user_id, u.nickname]));
  }

  const participants = (participantBills || []).map((pb) => ({
    ...pb,
    nickname: usersById[pb.user_id] || null,
  }));

  return { room, host, receipt: receipt || null, items, assignments, participants };
}

/**
 * Host creates a room.
 * POST /api/rooms/create
 * Inputs: { host_email, due_date, nickname }
 */
export async function createRoom(req, res) {
  const { host_email, due_date, nickname } = req.body;

  // 1. Inputs validation
  if (!host_email || !due_date) {
    return res.status(400).json({ error: 'Missing required parameters: host_email, due_date' });
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(host_email)) {
    return res.status(400).json({ error: 'Invalid host_email format' });
  }

  // Future due_date validation
  const parsedDueDate = new Date(due_date);
  if (isNaN(parsedDueDate.getTime())) {
    return res.status(400).json({ error: 'due_date must be a valid date' });
  }
  if (parsedDueDate <= new Date()) {
    return res.status(400).json({ error: 'due_date must be set in the future' });
  }

  try {
    // 2. Generate unique room code with collision defense loop (max 5 retries)
    let roomCode = '';
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 5) {
      roomCode = generateRoomCode(); // Crucial: Called inside loop to ensure new code on each retry
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

    let hostId;
    try {
      hostId = await resolveUserId(req, nickname || 'Host');
    } catch (err) {
      console.error('[Room Controller] Host identity resolution failed:', err);
      return res.status(500).json({ error: err.message });
    }

    // 4. Upsert host profile in public users table
    const { error: userError } = await supabaseAdmin.from('users').upsert({
      user_id: hostId,
      nickname: nickname?.trim() || 'Host',
      is_host: true
    });

    if (userError) {
      console.error('[Room Controller] Host profile upsert failed:', userError);
      return res.status(500).json({ error: `Failed to register host profile: ${userError.message}` });
    }

    // 5. Create the Bill Room
    const { data: room, error: roomError } = await supabaseAdmin
      .from('bill_rooms')
      .insert({
        room_code: roomCode,
        host_id: hostId,
        host_email: host_email.trim(),
        due_date: parsedDueDate.toISOString(),
        split_mode: 'EQUAL',
        status: 'ACTIVE'
      })
      .select()
      .single();

    if (roomError) {
      console.error('[Room Controller] Room creation failed:', roomError);
      return res.status(500).json({ error: `Failed to create room: ${roomError.message}` });
    }

    // 6. Bind Host as first participant in participant_bills (Host is verified by default)
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

    // 7. Set host_id Cookie in Response (dynamically configured secure/sameSite for local dev)
    res.cookie('host_id', hostId, cookieOptions);

    // 8. Return response (with root-level fields for backward compatibility with existing tests)
    return res.status(201).json({
      success: true,
      message: 'Room created successfully',
      room_id: room.room_id,
      room_code: room.room_code,
      host_id: hostId,
      data: {
        room_id: room.room_id,
        room_code: room.room_code,
        status: room.status,
        due_date: room.due_date
      }
    });
  } catch (error) {
    console.error('[Room Controller] Create Room Exception:', error);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
}

/**
 * Fetch full room state for host dashboard / resume.
 * GET /api/rooms/:room_id
 */
/**
 * Public lookup by 6-character room code (join / enter-room flows).
 * GET /api/rooms/code/:room_code
 */
export async function getRoomByCode(req, res) {
  const code = req.params.room_code?.toUpperCase().trim();
  if (!code) {
    return res.status(400).json({ error: 'Missing room_code' });
  }

  try {
    const { data: room, error: roomError } = await supabaseAdmin
      .from('bill_rooms')
      .select('room_id')
      .eq('room_code', code)
      .maybeSingle();

    if (roomError || !room) {
      return res.status(404).json({ error: 'Room not found.' });
    }

    const payload = await buildRoomPayload(room.room_id);
    if (!payload) {
      return res.status(404).json({ error: 'Room not found.' });
    }

    return res.status(200).json({ success: true, ...payload });
  } catch (error) {
    console.error('[Room Controller] Get Room By Code Exception:', error);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
}

export async function getRoom(req, res) {
  const { room_id: roomId } = req.params;

  if (!roomId) {
    return res.status(400).json({ error: 'Missing room_id' });
  }

  try {
    const payload = await buildRoomPayload(roomId);
    if (!payload?.room) {
      return res.status(404).json({ error: 'Room not found.' });
    }

    const userId = req.user?.id;
    const isHost = payload.room.host_id === userId;
    const isParticipant = (payload.participants || []).some((p) => p.user_id === userId);

    if (!isHost && !isParticipant) {
      return res.status(403).json({ error: 'You do not have access to this room.' });
    }

    return res.status(200).json({ success: true, ...payload });
  } catch (error) {
    console.error('[Room Controller] Get Room Exception:', error);
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

  if (!room_code || !nickname) {
    return res.status(400).json({ error: 'Missing required parameters: room_code, nickname' });
  }

  try {
    let userId;
    try {
      userId = await resolveUserId(req, nickname.trim());
    } catch (err) {
      console.error('[Room Controller] Member identity resolution failed:', err);
      return res.status(500).json({ error: err.message });
    }

    res.cookie('user_id', userId, cookieOptions);
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

    // 2. Resolve Guest Identity (Bearer auth OR Cookies check OR register a new anonymous user profile)
    let resolvedUserId = null;

    // A. Check req.user from optional authentication layer if present
    if (req.user && req.user.id) {
      resolvedUserId = req.user.id;
    }

    // B. Check Bearer Authorization header
    if (!resolvedUserId && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      const token = req.headers.authorization.split(' ')[1];
      try {
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
        if (!error && user) {
          resolvedUserId = user.id;
        }
      } catch (err) {
        console.error('[Room Controller] Bearer token retrieval failed in join:', err);
      }
    }

    // C. Check Cookies (user_id or host_id)
    if (!resolvedUserId) {
      const cookieUserId = getCookie(req, 'user_id') || getCookie(req, 'host_id');
      if (cookieUserId) {
        resolvedUserId = cookieUserId;
      }
    }

    // D. If still not resolved, register a new anonymous account in auth.users
    if (!resolvedUserId) {
      const { data: { user: newAuthUser }, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
        email_confirm: true,
        user_metadata: { nickname: nickname.trim() }
      });

      if (createAuthError || !newAuthUser) {
        console.error('[Room Controller] Anonymous participant auth user creation failed:', createAuthError);
        return res.status(500).json({ error: `Failed to create anonymous session: ${createAuthError?.message || 'Unknown'}` });
      }
      resolvedUserId = newAuthUser.id;
    }

    const isHost = room.host_id === resolvedUserId;

    // 3. Upsert participant user profile in public users table
    const { error: userError } = await supabaseAdmin.from('users').upsert({
      user_id: resolvedUserId,
      nickname: nickname.trim(),
      is_host: isHost
    });

    if (userError) {
      console.error('[Room Controller] Participant upsert failed:', userError);
      return res.status(500).json({ error: `Failed to register participant: ${userError.message}` });
    }

    // 4. Register user to room by creating record in participant_bills (Host is verified by default)
    const { error: pbError } = await supabaseAdmin.from('participant_bills').upsert({
      room_id: room.room_id,
      user_id: resolvedUserId,
      amount_to_pay: 0.00,
      payment_status: isHost ? 'VERIFIED' : 'PENDING'
    }, {
      onConflict: 'room_id,user_id'
    });

    if (pbError) {
      console.error('[Room Controller] Participant binding failed:', pbError);
      return res.status(500).json({ error: `Failed to join room: ${pbError.message}` });
    }

    // 5. Set user_id Cookie in Response (dynamically configured secure/sameSite for local dev)
    res.cookie('user_id', resolvedUserId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    // 6. Trigger dynamic bill recalculation immediately (Equal mode re-split or item updates)
    await calculateBill(room.room_id);

    return res.status(200).json({
      success: true,
      room_id: room.room_id,
      user_id: resolvedUserId
    });
  } catch (error) {
    console.error('[Room Controller] Join Room Exception:', error);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
}
