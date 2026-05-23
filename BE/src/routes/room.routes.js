import { Router } from 'express';
import { createRoom, joinRoom } from '../controllers/room.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Protected room routes
router.post('/create', requireAuth, createRoom);
router.post('/join', requireAuth, joinRoom);

export default router;
