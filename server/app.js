const express = require('express');
const cors = require('cors');
const rateLimiter = require('./middleware/rateLimiter');

const app = express();

// Global request rate limiting
app.use(rateLimiter(200, 15 * 60 * 1000)); // 200 requests per 15 mins max

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/user', require('./routes/user'));

// Health check endpoint
app.get('/', (req, res) => {
  res.send('DevMeet Chat/Matchmaking Server Running');
});

// Secured debug endpoint to check queue and active pairs
app.get('/debug', (req, res) => {
  const secretHeader = req.headers['x-debug-secret'];
  const expectedSecret = process.env.ADMIN_DEBUG_SECRET || 'devmeet_local_debug_secret';
  
  if (secretHeader !== expectedSecret) {
    return res.status(403).json({ error: 'Access denied: Invalid debug secret' });
  }

  const socketStats = req.app.get('socketStats') || { queue: {}, activePairs: {} };
  res.json({
    queue: socketStats.queue,
    activePairs: socketStats.activePairs,
    activePairsCount: Object.keys(socketStats.activePairs).length
  });
});

module.exports = app;
