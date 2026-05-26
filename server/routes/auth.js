const express = require('express');
const router = express.Router();
const { register, getMe, login, googleLogin } = require('../controllers/authController');

router.post('/register', register);
router.get('/me', getMe);
router.post('/login', login);
router.post('/google', googleLogin);

module.exports = router;