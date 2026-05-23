import { Router } from 'express';
import { createRoom, getRoom, getRoomByCode, joinRoom } from '../controllers/room.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Room routes
router.post('/create', createRoom);
router.get('/code/:room_code', getRoomByCode);
router.post('/join', joinRoom);
router.get('/:room_id', requireAuth, getRoom);

export default router;
