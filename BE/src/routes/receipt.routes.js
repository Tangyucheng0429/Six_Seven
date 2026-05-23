import { Router } from 'express';
import { uploadReceipt, verifyReceipt } from '../controllers/receipt.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = Router();

// Protected receipt routes
router.post('/upload', requireAuth, upload.single('file'), uploadReceipt);
router.put('/verify', requireAuth, verifyReceipt);

export default router;
