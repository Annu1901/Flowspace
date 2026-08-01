const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ovvbrwqyjdeomzezhacu.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_3UnL1xJOnf9cLMaLTd-zJA_ztW4WeRy';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testConnection() {
  console.log('Testing connection to Supabase:', SUPABASE_URL);
  try {
    const { data, error } = await supabase.from('workspaces').select('*');
    if (error) {
      console.error('Supabase query error (Tables might not be created yet):', error.message);
    } else {
      console.log('Successfully connected to Supabase workspaces table! Count:', data.length);
    }
  } catch (err) {
    console.error('Connection failed:', err);
  }
}

testConnection();
