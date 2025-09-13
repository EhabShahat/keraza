#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const { loadEnv } = require('./utils/load-env');

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

(async () => {
  try {
    const ts = Date.now();
    const email = `crypt_test_${ts}@example.com`;
    const username = `crypt_test_${ts}`;
    const password = 'P@ssw0rd123!';

    console.log('🧪 Creating test user via RPC public.admin_create_user ...');
    const { data: created, error: createError } = await supabase.rpc('admin_create_user', {
      p_username: username,
      p_email: email,
      p_password: password,
      p_is_admin: false,
    });
    if (createError) {
      console.error('❌ admin_create_user error:', createError.message);
      process.exit(1);
    }
    console.log('✅ Created user:', created);

    console.log('🧪 Verifying login via RPC public.auth_login ...');
    const { data: loginData, error: loginError } = await supabase.rpc('auth_login', {
      p_identifier: email,
      p_password: password,
    });
    if (loginError) {
      console.error('❌ auth_login error:', loginError.message);
      process.exit(1);
    }
    console.log('✅ auth_login result:', loginData);

    console.log('\n🎉 crypt/gen_salt verified working with search_path to extensions.');
  } catch (err) {
    console.error('💥 Unexpected failure:', err.message);
    process.exit(1);
  }
})();
