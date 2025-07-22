const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Delete account endpoint
app.post('/api/delete-account', async (req, res) => {
  try {
    const { email, token } = req.body;

    // Validate inputs
    if (!email || !token) {
      return res.status(400).json({ 
        error: 'Email and token are required' 
      });
    }

    // Validate token (simple validation - you can make this more secure)
    const expectedToken = Buffer.from(`${email}:${Date.now()}`).toString('base64');
    if (token !== expectedToken) {
      return res.status(401).json({ 
        error: 'Invalid token' 
      });
    }

    // Get user by email
    const { data: user, error: userError } = await supabase.auth.admin.listUsers();
    const targetUser = user.users.find(u => u.email === email);

    if (!targetUser) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }

    const userId = targetUser.id;

    // Delete user data from all tables
    const tables = ['recordings', 'user_subscriptions', 'free_trials'];
    
    for (const table of tables) {
      const { error: deleteError } = await supabase
        .from(table)
        .delete()
        .eq('user_id', userId);

      if (deleteError) {
        console.error(`Error deleting from ${table}:`, deleteError);
      }
    }

    // Delete the user account
    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteUserError) {
      console.error('Error deleting user:', deleteUserError);
      return res.status(500).json({ 
        error: 'Failed to delete user account' 
      });
    }

    res.json({ 
      success: true, 
      message: 'Account deleted successfully' 
    });

  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Delete account server running on port ${PORT}`);
}); 