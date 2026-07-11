import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, '../src/staff/legacy');

const bootstraps = {
  'placeOrder.js': `
export async function bootstrapPlaceOrder() {
  supabaseClient = getSupabaseClient();
  window.supabaseClient = supabaseClient;
  if (!supabaseClient) return;
  initializeSupabase();
}

export function teardownPlaceOrder() {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
}
`,
  'ordersByMe.js': `
export async function bootstrapOrdersByMe() {
  supabaseClient = getSupabaseClient();
  window.supabaseClient = supabaseClient;
  if (!supabaseClient) return;
  initializeSupabase();
}

export function teardownOrdersByMe() {
  const client = getSupabaseClient();
  if (ordersChannel && client) client.removeChannel(ordersChannel);
  ordersChannel = null;
}
`,
  'allOrders.js': `
export async function bootstrapAllOrders() {
  supabaseClient = getSupabaseClient();
  window.supabaseClient = supabaseClient;
  if (!supabaseClient) return;
  initializeSupabase();
}

export function teardownAllOrders() {
  const client = getSupabaseClient();
  if (ordersChannel && client) client.removeChannel(ordersChannel);
  ordersChannel = null;
}
`,
};

const header = `'use strict';

import { supabase as sharedSupabase } from '../../lib/supabase.js';

// Staff module — adapted for React

`;

const initSupabaseReplacement = `  function getSupabaseClient() {
    return sharedSupabase || window.supabaseClient || null;
  }

  function initializeSupabase() {
    supabaseClient = getSupabaseClient();
    if (!supabaseClient) {
      console.error('Supabase client not initialized');
      return;
    }
    initializeApp();
  }

`;

for (const file of Object.keys(bootstraps)) {
  let content = fs.readFileSync(path.join(dir, file), 'utf8');
  content = content.replace(
    /^'use strict';\s*\n\s*\(function\(\) \{\s*\n\s*const SUPABASE_URL[^\n]+\n\s*const SUPABASE_ANON_KEY[^\n]+\s*\n\s*\n/,
    header,
  );
  content = content.replace(/window\.location\.href = 'staff_login\.html'/g, "window.location.href = '/staff'");
  content = content.replace(/window\.location\.href = 'staff_dashboard\.html'/g, "window.location.href = '/staff/dashboard'");
  content = content.replace(
    /  \/\/ Initialize Supabase\n  function initializeSupabase\(\) \{[\s\S]*?\n  \}\n/,
    initSupabaseReplacement,
  );
  content = content.replace(/\n  \/\/ Start initialization[\s\S]*$/, '');
  content = content.replace(/\}\)\(\);\s*$/, '');

  if (file === 'placeOrder.js') {
    content = content.replace(
      /let activeSessionId = null;/,
      'let activeSessionId = null;\n  let syncIntervalId = null;',
    );
    content = content.replace(
      /    \/\/ Periodically sync sessions \(every 30 seconds\)\n    setInterval\(\(\) => \{/,
      '    if (syncIntervalId) clearInterval(syncIntervalId);\n    syncIntervalId = setInterval(() => {',
    );
  }
  if (file === 'ordersByMe.js') {
    content = content.replace(
      /let selectedOrderId = null;/,
      'let selectedOrderId = null;\n  let ordersChannel = null;',
    );
    content = content.replace(
      /const channel = supabaseClient\n      \.channel\('staff-orders-by-me-channel'\)/,
      "ordersChannel = supabaseClient\n      .channel('staff-orders-by-me-channel')",
    );
  }
  if (file === 'allOrders.js') {
    content = content.replace(
      /let selectedOrderId = null;/,
      'let selectedOrderId = null;\n  let ordersChannel = null;',
    );
    content = content.replace(
      /const channel = supabaseClient\n      \.channel\('staff-orders-channel'\)/,
      "ordersChannel = supabaseClient\n      .channel('staff-orders-channel')",
    );
  }

  content = `${content.trimEnd()}\n${bootstraps[file]}`;
  fs.writeFileSync(path.join(dir, file), content, 'utf8');
  console.log(`Transformed ${file}`);
}
