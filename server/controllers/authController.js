const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');


const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hash });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'devmeetsecret');
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

const getMe = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'devmeetsecret');
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Ensure skills is always an array
    const userObj = user.toObject();
    if (!Array.isArray(userObj.skills)) {
      userObj.skills = [];
    }
    res.json({ user: userObj });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Please enter both email and password.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'No account found with that email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'No account found with that email or password.' });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'devmeetsecret');
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, uniqueId: user.uniqueId } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again later.' });
  }
};

const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: 'Google credential ID token required' });
    }

    // Verify token with Google's tokeninfo API
    const googleRes = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
    const { email, name, picture } = googleRes.data;

    if (!email) {
      return res.status(400).json({ error: 'Email not verified or missing in Google token' });
    }

    // Check if user exists
    let user = await User.findOne({ email });

    if (!user) {
      // Create user with Google info
      // Generate a random placeholder password
      const randomPassword = await bcrypt.hash(Math.random().toString(36).slice(-8), 10);
      user = await User.create({
        name,
        email,
        password: randomPassword,
        avatar: picture || '',
      });
    } else if (picture && !user.avatar) {
      // Keep avatar updated if missing
      user.avatar = picture;
      await user.save();
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'devmeetsecret');
    res.json({ 
      token, 
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        uniqueId: user.uniqueId, 
        avatar: user.avatar 
      } 
    });
  } catch (err) {
    console.error('Google login error:', err);
    res.status(500).json({ error: 'Google authentication failed' });
  }
};

module.exports = {
  register,
  getMe,
  login,
  googleLogin,
};
