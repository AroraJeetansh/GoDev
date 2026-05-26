const jwt = require('jsonwebtoken');
const User = require('../models/User');

const queues = {
  'Frontend': [],
  'Backend': [],
  'MERN': [],
  'DSA': [],
  'AI/ML': [],
  'System Design': [],
  'Mock Interview': [],
  'Resume Review': [],
  'Career Advice': [],
  'General Dev Chat': []
};

const activePairs = {};
const socketUsers = {};

const findMatchForSocket = (socketId, topic) => {
  const userData = socketUsers[socketId];
  if (!userData) return null;
  
  const topicQueue = queues[topic] || [];
  for (let i = 0; i < topicQueue.length; i++) {
    const partnerSocketId = topicQueue[i];
    if (partnerSocketId === socketId) continue;
    
    const partnerData = socketUsers[partnerSocketId];
    if (!partnerData) continue;
    
    // Check blocking safety:
    const userBlocksPartner = userData.blockedUsers && userData.blockedUsers.includes(partnerData.userId);
    const partnerBlocksUser = partnerData.blockedUsers && partnerData.blockedUsers.includes(userData.userId);
    
    if (!userBlocksPartner && !partnerBlocksUser) {
      // Valid match! Remove from queue and return
      topicQueue.splice(i, 1);
      return partnerSocketId;
    }
  }
  return null;
};

const addBackToQueue = (socketId, io) => {
  const data = socketUsers[socketId];
  if (data && data.topic) {
    const topic = data.topic;
    if (!queues[topic]) queues[topic] = [];
    if (!queues[topic].includes(socketId)) {
      queues[topic].push(socketId);
      console.log(`Added user ${data.uniqueId} back to queue for topic: ${topic}`);
      
      // Try to match them immediately
      const partnerSocketId = findMatchForSocket(socketId, topic);
      if (partnerSocketId) {
        // Remove socketId from queue
        const idx = queues[topic].indexOf(socketId);
        if (idx !== -1) queues[topic].splice(idx, 1);

        const partnerData = socketUsers[partnerSocketId];
        activePairs[socketId] = partnerSocketId;
        activePairs[partnerSocketId] = socketId;

        io.to(socketId).emit('match_found', { 
          partnerId: partnerData.uniqueId,
          partnerName: partnerData.name,
          partnerAvatar: partnerData.avatar
        });
        io.to(partnerSocketId).emit('match_found', { 
          partnerId: data.uniqueId,
          partnerName: data.name,
          partnerAvatar: data.avatar
        });
      }
    }
  }
};

const removeFromAllQueues = (socketId) => {
  for (const topic in queues) {
    const idx = queues[topic].indexOf(socketId);
    if (idx !== -1) {
      queues[topic].splice(idx, 1);
    }
  }
};

const handleSocketConnection = (io) => {
  io.on('connection', (socket) => {
    
    // Handle user authentication
    socket.on('authenticate', async (token) => {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'devmeetsecret');
        const user = await User.findById(decoded.id).select('-password');
        
        if (user) {
          socketUsers[socket.id] = {
            uniqueId: user.uniqueId,
            name: user.name,
            email: user.email,
            userId: user._id.toString(),
            blockedUsers: (user.blockedUsers || []).map(id => id.toString()),
            avatar: user.avatar || ''
          };
          console.log(`User authenticated: ${user.uniqueId} (${user.name})`);
          socket.emit('authenticated', { success: true });
        } else {
          socket.emit('authenticated', { success: false, error: 'User not found' });
        }
      } catch (err) {
        console.error('Authentication error:', err);
        socket.emit('authenticated', { success: false, error: 'Invalid token' });
      }
    });

    socket.on('find_match', ({ topic }) => {
      let userData = socketUsers[socket.id];
      if (!userData) {
        socket.emit('authenticated', { success: false, error: 'Authentication required' });
        return;
      }
      
      userData.topic = topic;
      removeFromAllQueues(socket.id);

      // Try to find a match
      const partnerSocketId = findMatchForSocket(socket.id, topic);
      if (partnerSocketId) {
        const partnerData = socketUsers[partnerSocketId];
        activePairs[socket.id] = partnerSocketId;
        activePairs[partnerSocketId] = socket.id;

        console.log(`Match found: ${userData.uniqueId} <-> ${partnerData.uniqueId}`);
        
        socket.emit('match_found', { 
          partnerId: partnerData.uniqueId,
          partnerName: partnerData.name,
          partnerAvatar: partnerData.avatar
        });
        io.to(partnerSocketId).emit('match_found', { 
          partnerId: userData.uniqueId,
          partnerName: userData.name,
          partnerAvatar: userData.avatar
        });
      } else {
        if (!queues[topic]) queues[topic] = [];
        if (!queues[topic].includes(socket.id)) {
          queues[topic].push(socket.id);
        }
        console.log(`User ${userData.uniqueId} added to queue for topic: ${topic}. Queue length: ${queues[topic].length}`);
      }
    });

    // Relays WebRTC signaling data
    socket.on('signal', ({ to, signal }) => {
      const partnerSocketId = activePairs[socket.id];
      if (partnerSocketId) {
        const userData = socketUsers[socket.id];
        io.to(partnerSocketId).emit('signal', { 
          from: userData ? userData.uniqueId : socket.id, 
          signal 
        });
      }
    });

    socket.on('send_message', ({ to, message }) => {
      const partnerSocketId = activePairs[socket.id];
      if (partnerSocketId) {
        io.to(partnerSocketId).emit('receive_message', { from: socket.id, message });
      }
    });

    socket.on('leave', () => {
      const partnerId = activePairs[socket.id];
      if (partnerId) {
        io.to(partnerId).emit('partner_left');
        delete activePairs[partnerId];
        delete activePairs[socket.id];
      }
      removeFromAllQueues(socket.id);
    });

    socket.on('leave_chat', ({ partnerId }) => {
      console.log(`User ${socket.id} leaving chat with partner ${partnerId}`);
      
      const actualPartnerSocketId = activePairs[socket.id];
      if (actualPartnerSocketId) {
        io.to(actualPartnerSocketId).emit('partner_left');
        
        delete activePairs[socket.id];
        delete activePairs[actualPartnerSocketId];
        
        addBackToQueue(actualPartnerSocketId, io);
      }
      
      removeFromAllQueues(socket.id);
    });

    socket.on('disconnect', () => {
      const partnerId = activePairs[socket.id];
      if (partnerId) {
        io.to(partnerId).emit('partner_left');
        delete activePairs[partnerId];
        delete activePairs[socket.id];
        
        addBackToQueue(partnerId, io);
      }
      removeFromAllQueues(socket.id);
      delete socketUsers[socket.id];
    });

    socket.on('typing', () => {
      const partnerId = activePairs[socket.id];
      if (partnerId) {
        io.to(partnerId).emit('typing');
      }
    });

    socket.on('screen_sharing_started', () => {
      const partnerId = activePairs[socket.id];
      if (partnerId) {
        io.to(partnerId).emit('screen_sharing_started', { from: socket.id });
      }
    });

    socket.on('screen_sharing_stopped', () => {
      const partnerId = activePairs[socket.id];
      if (partnerId) {
        io.to(partnerId).emit('screen_sharing_stopped', { from: socket.id });
      }
    });

    socket.on('next_partner', ({ partnerId }) => {
      console.log(`User ${socket.id} requesting next partner, current partner: ${partnerId}`);
      
      const actualPartnerSocketId = activePairs[socket.id];
      if (actualPartnerSocketId) {
        io.to(actualPartnerSocketId).emit('partner_next');
        
        delete activePairs[socket.id];
        delete activePairs[actualPartnerSocketId];
        
        addBackToQueue(actualPartnerSocketId, io);
        addBackToQueue(socket.id, io);
      }
      
      removeFromAllQueues(socket.id);
    });
  });
};

module.exports = {
  handleSocketConnection,
  queues,
  activePairs,
  socketUsers
};
