#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const { loadEnv } = require('./utils/load-env');

function parseArgs(argv) {
  const args = { admin: true };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--email') args.email = argv[++i];
    else if (a === '--username') args.username = argv[++i];
    else if (a === '--password') args.password = argv[++i];
    else if (a === '--no-admin') args.admin = false;
  }
  return args;
}

(async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
    process.exit(1);
  }

  const { email, username, password, admin } = parseArgs(process.argv);
  if ((!email && !username) || !password) {
    console.log('Usage: node scripts/create-admin.js --email you@example.com [--username admin] --password "StrongPass123!" [--no-admin]');
    process.exit(2);
  }

  const supabase = createClient(url, serviceKey);

  console.log('Creating user via RPC admin_create_user ...');
  const { data, error } = await supabase.rpc('admin_create_user', {
    p_username: username || null,
    p_email: email || null,
    p_password: password,
    p_is_admin: !!admin,
  });

  if (error) {
    console.error('❌ RPC error:', error.message);
    process.exit(1);
  }

  const row = Array.isArray(data) ? data[0] : data;
  console.log('✅ Created user:', {
    user_id: row?.user_id,
    username: row?.username || username || null,
    email: row?.email || email || null,
    is_admin: !!admin,
  });
})();
