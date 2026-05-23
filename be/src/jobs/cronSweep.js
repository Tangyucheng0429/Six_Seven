import { checkDueRoomsAndNotify } from '../services/cron.service.js';

/**
 * Background cron sweep job wrapper.
 * Can be triggered directly by Vercel Cron or an external trigger script.
 */
export async function runCronSweep() {
  await checkDueRoomsAndNotify();
}
