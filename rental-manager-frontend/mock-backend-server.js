const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 8000;

// Enable CORS for localhost:3000
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));

app.use(express.json());

// Mock user data
const users = {
  admin: {
    username: 'admin',
    password: 'K8mX#9vZ$pL2@nQ7!wR4&dF6^sA1*uE3',
    role: { name: 'Administrator', id: 1 },
    first_name: 'Admin',
    last_name: 'User',
    email: 'admin@example.com',
    id: 1
  },
  manager: {
    username: 'manager', 
    password: 'mR9#wE4$xN7!kP2&sL6^fA1*tZ5@gB8',
    role: { name: 'Manager', id: 2 },
    first_name: 'Manager',
    last_name: 'User',
    email: 'manager@example.com',
    id: 2
  },
  staff: {
    username: 'staff',
    password: 'sT3#qW8$vE1!nM5&rA9^jK2*xL6@pC4',
    role: { name: 'Staff', id: 3 },
    first_name: 'Staff',
    last_name: 'User', 
    email: 'staff@example.com',
    id: 3
  }
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  console.log('💚 Health check request received');
  res.json({
    status: 'healthy',
    message: 'Mock backend server is running',
    timestamp: new Date().toISOString()
  });
});

// Login endpoint
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  console.log('🔐 Login attempt:', { username, password: '***HIDDEN***' });
  console.log('📥 Request body:', req.body);
  console.log('📤 Request headers:', req.headers);
  
  // Find user by username
  const user = Object.values(users).find(u => u.username === username);
  
  if (!user) {
    console.log('❌ User not found:', username);
    return res.status(401).json({
      success: false,
      message: 'Invalid username or password',
      detail: 'User not found'
    });
  }
  
  if (user.password !== password) {
    console.log('❌ Invalid password for user:', username);
    return res.status(401).json({
      success: false,
      message: 'Invalid username or password', 
      detail: 'Incorrect password'
    });
  }
  
  // Generate mock tokens
  const accessToken = `mock_access_token_${user.id}_${Date.now()}`;
  const refreshToken = `mock_refresh_token_${user.id}_${Date.now()}`;
  
  console.log('✅ Login successful for user:', username);
  
  // Return successful response
  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: user.role
      },
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour
    },
    message: 'Login successful'
  });
});

// Token refresh endpoint
app.post('/api/auth/refresh', (req, res) => {
  const { refresh_token } = req.body;
  
  console.log('🔄 Token refresh request');
  
  if (!refresh_token || !refresh_token.startsWith('mock_refresh_token_')) {
    return res.status(401).json({
      success: false,
      message: 'Invalid refresh token'
    });
  }
  
  // Generate new tokens
  const userId = refresh_token.split('_')[3];
  const newAccessToken = `mock_access_token_${userId}_${Date.now()}`;
  const newExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  
  res.json({
    success: true,
    data: {
      access_token: newAccessToken,
      expires_at: newExpiresAt
    }
  });
});

// User info endpoint (for testing auth)
app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'No token provided'
    });
  }
  
  const token = authHeader.replace('Bearer ', '');
  
  if (!token.startsWith('mock_access_token_')) {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
  
  const userId = token.split('_')[3];
  const user = Object.values(users).find(u => u.id.toString() === userId);
  
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'User not found'
    });
  }
  
  res.json({
    success: true,
    data: {
      id: user.id,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      role: user.role
    }
  });
});

// Catch all other API routes
app.use('/api/*', (req, res) => {
  console.log(`🔍 API request to: ${req.method} ${req.path}`);
  res.status(404).json({
    success: false,
    message: 'Endpoint not found in mock server',
    detail: `${req.method} ${req.path} is not implemented`
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('💥 Server error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    detail: error.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 Mock Backend Server Started');
  console.log('═'.repeat(50));
  console.log(`📍 Server URL: http://localhost:${PORT}`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/api/health`);
  console.log('');
  console.log('🎭 Available Demo Users:');
  Object.values(users).forEach(user => {
    console.log(`   • ${user.username} (${user.role.name})`);
  });
  console.log('');
  console.log('🔐 API Endpoints:');
  console.log('   • POST /api/auth/login');
  console.log('   • POST /api/auth/refresh'); 
  console.log('   • GET /api/auth/me');
  console.log('   • GET /api/health');
  console.log('');
  console.log('✅ Ready to accept login requests!');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Mock backend server shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Mock backend server terminated');
  process.exit(0);
});