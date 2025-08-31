#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { loadEnv } = require('./utils/load-env');

(async function main() {
  loadEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey);

  const root = path.resolve(__dirname, '..');
  const files = [
    path.join(root, 'db', 'security.sql'),
    path.join(root, 'db', 'rpc_functions.sql'),
  ];

  function splitSQL(input) {
    const stmts = [];
    let buf = '';
    let i = 0;
    let inS = false; // '
    let inD = false; // "
    let dollarTag = null; // e.g. $function$
    while (i < input.length) {
      const ch = input[i];
      const next2 = input.slice(i, i + 2);
      // line comment --
      if (!inS && !inD && !dollarTag && next2 === '--') {
        const nl = input.indexOf('\n', i + 2);
        if (nl === -1) { break; }
        buf += input.slice(i, nl + 1);
        i = nl + 1;
        continue;
      }
      // dollar-quote start/end
      if (!inS && !inD) {
        const m = input.slice(i).match(/^\$[a-zA-Z0-9_]*\$/);
        if (m) {
          const tag = m[0];
          if (!dollarTag) {
            dollarTag = tag;
          } else if (tag === dollarTag) {
            dollarTag = null;
          }
          buf += tag;
          i += tag.length;
          continue;
        }
      }
      if (!dollarTag) {
        if (ch === "'" && !inD) {
          inS = !inS; buf += ch; i++; continue;
        }
        if (ch === '"' && !inS) {
          inD = !inD; buf += ch; i++; continue;
        }
      }
      if (ch === ';' && !inS && !inD && !dollarTag) {
        const trimmed = buf.trim();
        if (trimmed) stmts.push(trimmed);
        buf = '';
        i++;
        continue;
      }
      buf += ch;
      i++;
    }
    const tail = buf.trim();
    if (tail) stmts.push(tail);
    return stmts;
  }

  for (const file of files) {
    if (!fs.existsSync(file)) {
      console.warn(`Skip: ${file} not found`);
      continue;
    }
    const sql = fs.readFileSync(file, 'utf8');
    console.log(`\n==> Applying ${path.relative(root, file)} ...`);
    const statements = splitSQL(sql);
    let ok = 0, fail = 0;
    for (const [idx, stmt] of statements.entries()) {
      const { error } = await supabase.rpc('exec_sql', { sql: stmt });
      if (error) {
        console.error(`  ❌ [${idx+1}/${statements.length}]`, error.message);
        fail++;
      } else {
        ok++;
        if (idx % 10 === 0) {
          console.log(`  ✅ Applied ${ok}/${statements.length} ...`);
        }
      }
    }
    if (fail > 0) {
      console.error(`❌ ${fail} statements failed in ${path.basename(file)}`);
      process.exitCode = 1;
    } else {
      console.log(`✅ Applied ${ok} statements from ${path.basename(file)}`);
    }
  }

  if (process.exitCode) {
    console.error('\nOne or more errors occurred applying SQL.');
    process.exit(process.exitCode);
  } else {
    console.log('\n🎉 SQL successfully applied.');
  }
})();
