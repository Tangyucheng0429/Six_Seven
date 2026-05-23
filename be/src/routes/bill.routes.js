import { Router } from 'express';
import { configSplit, assignItems } from '../controllers/bill.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = Router();

// Protected billing routes
router.post('/config-split', requireAuth, upload.single('qr_code_file'), configSplit);
router.post('/assign-items', requireAuth, assignItems);

export default router;
