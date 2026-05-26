const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const connectDB = require('./config/db');
const app = require('./app');
const { handleSocketConnection, queue, activePairs } = require('./sockets/socketHandler');

const PORT = process.env.PORT || 5000;

connectDB();

// Create HTTP Server
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

handleSocketConnection(io);

app.set('socketStats', { queue, activePairs });

// Start Listening
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});