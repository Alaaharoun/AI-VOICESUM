const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Supabase configuration
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ai-voicesum.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Serve delete account page
app.get('/simple-delete-account.html', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Delete Account - AI VoiceSum</title>
    <script src="https://unpkg.com/@supabase/supabase-js@2"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: #F8FAFC;
            color: #1F2937;
            line-height: 1.6;
            padding: 20px;
        }
        
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 16px;
            padding: 40px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        
        .logo-icon {
            font-size: 40px;
            margin-bottom: 8px;
        }
        
        .logo {
            font-size: 32px;
            font-weight: bold;
            color: #2563EB;
            margin-bottom: 16px;
        }
        
        .title {
            font-size: 28px;
            font-weight: bold;
            color: #1F2937;
            margin-bottom: 8px;
        }
        
        .subtitle {
            font-size: 16px;
            color: #6B7280;
        }
        
        .warning {
            background-color: #FEE2E2;
            border: 1px solid #DC2626;
            border-radius: 16px;
            padding: 20px;
            margin-bottom: 24px;
        }
        
        .warning-title {
            font-size: 18px;
            font-weight: bold;
            color: #DC2626;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
        }
        
        .warning-icon {
            margin-right: 8px;
            font-size: 20px;
        }
        
        .warning-text {
            font-size: 14px;
            color: #DC2626;
            line-height: 1.6;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        .form-label {
            display: block;
            font-size: 14px;
            font-weight: 600;
            color: #374151;
            margin-bottom: 8px;
        }
        
        .form-input {
            width: 100%;
            padding: 12px 16px;
            border: 1px solid #D1D5DB;
            border-radius: 8px;
            font-size: 14px;
        }
        
        .form-input:focus {
            outline: none;
            border-color: #2563EB;
            box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }
        
        .delete-button {
            width: 100%;
            background-color: #DC2626;
            color: white;
            border: none;
            border-radius: 16px;
            padding: 16px 24px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            margin-bottom: 16px;
            transition: background-color 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .delete-button:hover {
            background-color: #B91C1C;
        }
        
        .delete-button:disabled {
            background-color: #9CA3AF;
            cursor: not-allowed;
        }
        
        .delete-icon {
            margin-right: 8px;
            font-size: 18px;
        }
        
        .message {
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 16px;
        }
        
        .message.success {
            background-color: #ECFDF5;
            border: 1px solid #10B981;
            color: #047857;
        }
        
        .message.error {
            background-color: #FEE2E2;
            border: 1px solid #EF4444;
            color: #DC2626;
        }
        
        .loading {
            text-align: center;
            color: #6B7280;
        }
        
        .back-link {
            text-align: center;
            margin-top: 24px;
        }
        
        .back-link a {
            color: #2563EB;
            text-decoration: none;
            font-weight: 500;
        }
        
        .back-link a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo-icon">🎤</div>
            <div class="logo">AI VoiceSum</div>
            <h1 class="title">Delete Account</h1>
            <p class="subtitle">Permanently remove your account and all associated data</p>
        </div>

        <div class="warning">
            <div class="warning-title">
                <span class="warning-icon">🗑️</span>
                Warning
            </div>
            <div class="warning-text">
                This action will permanently delete your account and all associated data including:
                <br>• All your voice recordings and transcriptions
                <br>• Translation history
                <br>• AI summaries
                <br>• Subscription information
                <br><br>
                <strong>This action cannot be undone.</strong>
            </div>
        </div>

        <div id="deleteForm">
            <div class="form-group">
                <label class="form-label" for="email">Email Address:</label>
                <input type="email" id="email" class="form-input" placeholder="Enter your email address" required>
            </div>

            <div class="form-group">
                <label class="form-label" for="password">Password:</label>
                <input type="password" id="password" class="form-input" placeholder="Enter your password" required>
            </div>

            <div class="form-group">
                <label class="form-label" for="confirmText">Type "DELETE" to confirm:</label>
                <input type="text" id="confirmText" class="form-input" placeholder="Type DELETE" required>
            </div>

            <button id="deleteBtn" class="delete-button" onclick="deleteAccount()">
                <span class="delete-icon">🗑️</span>
                Delete My Account
            </button>
        </div>

        <div id="message"></div>
        
        <div class="back-link">
            <a href="javascript:history.back()">← Back to App</a>
        </div>
    </div>

    <script>
        async function deleteAccount() {
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirmText = document.getElementById('confirmText').value;
            const deleteBtn = document.getElementById('deleteBtn');
            const messageDiv = document.getElementById('message');

            // Validate inputs
            if (!email || !password || !confirmText) {
                showMessage('Please fill in all fields.', 'error');
                return;
            }

            if (confirmText !== 'DELETE') {
                showMessage('Please type "DELETE" to confirm.', 'error');
                return;
            }

            // Show loading
            deleteBtn.disabled = true;
            deleteBtn.innerHTML = '<span class="delete-icon">⏳</span>Deleting Account...';
            showMessage('Processing your request...', 'loading');

            try {
                // Call server API to delete account
                const response = await fetch('/api/delete-account', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email: email,
                        password: password
                    })
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || 'Failed to delete account');
                }

                showMessage('Account deleted successfully!', 'success');
                document.getElementById('deleteForm').style.display = 'none';

            } catch (error) {
                console.error('Delete account error:', error);
                showMessage(error.message || 'Failed to delete account. Please try again.', 'error');
                deleteBtn.disabled = false;
                deleteBtn.innerHTML = '<span class="delete-icon">🗑️</span>Delete My Account';
            }
        }

        function showMessage(text, type) {
            const messageDiv = document.getElementById('message');
            messageDiv.className = \`message \${type}\`;
            messageDiv.textContent = text;
        }
    </script>
</body>
</html>
  `);
});

// Delete account endpoint
app.post('/api/delete-account', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate inputs
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required' 
      });
    }

    // Sign in to verify credentials
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (signInError) {
      return res.status(401).json({ 
        error: 'Invalid email or password' 
      });
    }

    const user = signInData.user;
    const userId = user.id;

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
  console.log(`Delete account page available at: http://localhost:${PORT}/simple-delete-account.html`);
  console.log(`Health check available at: http://localhost:${PORT}/health`);
}); 