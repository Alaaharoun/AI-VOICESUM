const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // You'll need to add this to your .env file

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  console.error('- EXPO_PUBLIC_SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  console.error('\nPlease add these to your .env file');
  process.exit(1);
}

// Create Supabase client with service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  try {
    console.log('Starting migration application...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20250704230000_fix_superadmin_system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Applying superadmin system fix migration...');
    
    // Execute the migration using rpc
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    
    if (error) {
      console.error('Migration failed:', error);
      return;
    }
    
    console.log('Migration applied successfully!');
    
    // Apply the daily usage function migration
    const dailyUsagePath = path.join(__dirname, 'supabase', 'migrations', '20250704231000_add_daily_usage_function.sql');
    const dailyUsageSQL = fs.readFileSync(dailyUsagePath, 'utf8');
    
    console.log('Applying daily usage function migration...');
    
    const { data: dailyData, error: dailyError } = await supabase.rpc('exec_sql', { sql: dailyUsageSQL });
    
    if (dailyError) {
      console.error('Daily usage migration failed:', dailyError);
      return;
    }
    
    console.log('All migrations applied successfully!');
    
    // Verify the setup
    console.log('\nVerifying superadmin setup...');
    
    const { data: superadminUsers, error: userError } = await supabase
      .from('user_roles_view')
      .select('*')
      .eq('role_name', 'superadmin');
    
    if (userError) {
      console.error('Error checking superadmin users:', userError);
    } else {
      console.log(`Found ${superadminUsers.length} superadmin users:`);
      superadminUsers.forEach(user => {
        console.log(`- ${user.email}`);
      });
    }
    
  } catch (error) {
    console.error('Error applying migration:', error);
  }
}

// Alternative approach using direct SQL execution
async function applyMigrationDirect() {
  try {
    console.log('Starting direct migration application...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20250704230000_fix_superadmin_system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('/*'));
    
    console.log(`Executing ${statements.length} SQL statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          const { error } = await supabase.rpc('exec_sql', { sql: statement });
          if (error) {
            console.error(`Error in statement ${i + 1}:`, error);
            console.error('Statement:', statement);
          } else {
            console.log(`✓ Statement ${i + 1} executed successfully`);
          }
        } catch (err) {
          console.error(`Error executing statement ${i + 1}:`, err);
        }
      }
    }
    
    console.log('Migration completed!');
    
  } catch (error) {
    console.error('Error applying migration:', error);
  }
}

// Check if exec_sql function exists, if not, use direct approach
async function checkAndApply() {
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql: 'SELECT 1' });
    
    if (error && error.message.includes('function "exec_sql" does not exist')) {
      console.log('exec_sql function not available, using direct SQL approach...');
      await applyMigrationDirect();
    } else {
      console.log('Using exec_sql function...');
      await applyMigration();
    }
  } catch (error) {
    console.log('Falling back to direct SQL approach...');
    await applyMigrationDirect();
  }
}

// Run the migration
checkAndApply();

// تم حذف كود إضافة usage_seconds. إذا أردت تنفيذ الإضافة استخدم السكريبت المستقل الجديد فقط. 