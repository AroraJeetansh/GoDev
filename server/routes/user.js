const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer();
const { authenticateToken } = require('../middleware/authMiddleware');
const {
  updateProfile,
  blockUser,
  reportUser,
  getPublicProfile,
  searchUsers,
} = require('../controllers/userController');

// All profile update, block, and report requests require authentication
router.put('/profile', authenticateToken, upload.none(), updateProfile);
router.post('/block', authenticateToken, blockUser);
router.post('/report', authenticateToken, reportUser);

// Public lookup endpoints
router.get('/profile/:uniqueId', getPublicProfile);
router.get('/search', searchUsers);

module.exports = router;