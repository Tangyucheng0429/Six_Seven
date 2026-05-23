import { Router } from 'express';
import { submitProof, verifyMemberPayment } from '../controllers/payment.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = Router();

// Protected payment routes
router.post('/submit-proof', requireAuth, upload.single('proof_file'), submitProof);
router.post('/verify-member', requireAuth, verifyMemberPayment);

export default router;
