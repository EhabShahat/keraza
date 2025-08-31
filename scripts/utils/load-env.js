const fs = require('fs');
const path = require('path');

function parseEnv(content) {
  const env = {};
  const lines = content.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

function applyEnv(envObj) {
  for (const [k, v] of Object.entries(envObj)) {
    if (process.env[k] === undefined) {
      process.env[k] = v;
    }
  }
}

function loadEnv() {
  const root = path.resolve(__dirname, '..', '..');
  const candidates = [
    path.join(root, '.env.local'),
    path.join(root, '.env')
  ];
  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        const txt = fs.readFileSync(file, 'utf8');
        const env = parseEnv(txt);
        applyEnv(env);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[env] Failed to load ${file}:`, e.message);
    }
  }
}

module.exports = { loadEnv };
