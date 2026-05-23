import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, '../../data/notification-state.json');

function loadState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return {};
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

/** Returns true if enough time passed since last send for this key. */
export function shouldNotify(key, cooldownMs) {
  const state = loadState();
  const last = state[key];
  if (!last) return true;
  return Date.now() - last >= cooldownMs;
}

export function markNotified(key) {
  const state = loadState();
  state[key] = Date.now();
  saveState(state);
}
