const http = require('http');
const url = require('url');

const PORT = 8000;

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

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

function sendJSON(res, statusCode, data) {
  setCorsHeaders(res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method;

  console.log(`📤 ${method} ${path}`);

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    setCorsHeaders(res);
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    // Health check
    if (path === '/api/health' && method === 'GET') {
      console.log('💚 Health check request');
      sendJSON(res, 200, {
        status: 'healthy',
        message: 'Simple mock backend is running',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Login endpoint
    if (path === '/api/auth/login' && method === 'POST') {
      const body = await readBody(req);
      const { username, password } = body;
      
      console.log('🔐 Login attempt:', { username, password: '***HIDDEN***' });
      
      // Find user
      const user = Object.values(users).find(u => u.username === username);
      
      if (!user || user.password !== password) {
        console.log('❌ Invalid credentials');
        sendJSON(res, 401, {
          success: false,
          message: 'Invalid username or password',
          detail: 'Authentication failed'
        });
        return;
      }
      
      // Generate tokens
      const accessToken = `mock_access_${user.id}_${Date.now()}`;
      const refreshToken = `mock_refresh_${user.id}_${Date.now()}`;
      
      console.log('✅ Login successful for:', username);
      
      sendJSON(res, 200, {
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
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
        },
        message: 'Login successful'
      });
      return;
    }

    // Token refresh
    if (path === '/api/auth/refresh' && method === 'POST') {
      const body = await readBody(req);
      const { refresh_token } = body;
      
      console.log('🔄 Token refresh');
      
      if (!refresh_token || !refresh_token.includes('mock_refresh_')) {
        sendJSON(res, 401, {
          success: false,
          message: 'Invalid refresh token'
        });
        return;
      }
      
      const userId = refresh_token.split('_')[2];
      sendJSON(res, 200, {
        success: true,
        data: {
          access_token: `mock_access_${userId}_${Date.now()}`,
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
        }
      });
      return;
    }

    // User info
    if (path === '/api/auth/me' && method === 'GET') {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        sendJSON(res, 401, {
          success: false,
          message: 'No token provided'
        });
        return;
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      if (!token.includes('mock_access_')) {
        sendJSON(res, 401, {
          success: false,
          message: 'Invalid token'
        });
        return;
      }
      
      const userId = token.split('_')[2];
      const user = Object.values(users).find(u => u.id.toString() === userId);
      
      if (!user) {
        sendJSON(res, 401, {
          success: false,
          message: 'User not found'
        });
        return;
      }
      
      sendJSON(res, 200, {
        success: true,
        data: user
      });
      return;
    }

    // 404 for other routes
    console.log(`🔍 Route not found: ${method} ${path}`);
    sendJSON(res, 404, {
      success: false,
      message: 'Endpoint not found',
      detail: `${method} ${path} not implemented`
    });

  } catch (error) {
    console.error('💥 Server error:', error);
    sendJSON(res, 500, {
      success: false,
      message: 'Internal server error',
      detail: error.message
    });
  }
});

server.listen(PORT, () => {
  console.log('🚀 Simple Mock Backend Started');
  console.log('═'.repeat(40));
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`🏥 Health: http://localhost:${PORT}/api/health`);
  console.log('');
  console.log('🎭 Demo Users:');
  Object.values(users).forEach(user => {
    console.log(`   • ${user.username} (${user.role.name})`);
  });
  console.log('');
  console.log('✅ Ready for login tests!');
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  server.close(() => {
    process.exit(0);
  });
});