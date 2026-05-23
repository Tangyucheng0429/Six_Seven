/**
 * Generates a unique 6-character room code.
 * Excludes easily confusable characters like 0, O, 1, I, L.
 * @returns {string} Unique room code
 */
export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Rounds a number to exactly two decimal places.
 * Handled with EPSILON to prevent common floating point precision issues.
 * @param {number} num - The number to round
 * @returns {number} Rounded number
 */
export function roundToTwoDecimals(num) {
  const val = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(val) || !isFinite(val)) return 0.00;
  return Math.round((val + Number.EPSILON) * 100) / 100;
}
