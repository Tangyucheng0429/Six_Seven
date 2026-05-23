import { Router } from 'express';
import { checkDueRoomsAndNotify } from '../services/cron.service.js';

const router = Router();

/**
 * Webhook route to trigger overdue payments check and reminders.
 * Can be called by Vercel Cron, external monitor, or manual API request.
 * POST /api/cron/check-due
 */
router.post('/check-due', async (req, res) => {
  try {
    // Fire-and-forget background execution to prevent Vercel/Express request timeouts
    checkDueRoomsAndNotify();
    return res.status(200).json({
      success: true,
      message: 'Overdue room sweep initiated in background successfully.'
    });
  } catch (error) {
    console.error('[Cron Route] Failed to trigger check:', error);
    return res.status(500).json({ error: `Trigger failed: ${error.message}` });
  }
});

export default router;
