import { Router } from 'express';
import { createRoom, joinRoom } from '../controllers/room.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Room routes
router.post('/create', createRoom);
router.post('/join', joinRoom);


export default router;
