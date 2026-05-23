import { Router } from 'express';
import roomRoutes from './room.routes.js';
import receiptRoutes from './receipt.routes.js';
import billRoutes from './bill.routes.js';
import paymentRoutes from './payment.routes.js';
import cronRoutes from './cron.routes.js';

const router = Router();

router.use('/rooms', roomRoutes);
router.use('/receipts', receiptRoutes);
router.use('/bills', billRoutes);
router.use('/payments', paymentRoutes);
router.use('/cron', cronRoutes);

export default router;
