const mongoose = require('mongoose');

function generateUniqueId(length = 10) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  avatar: { type: String, default: '' },
  uniqueId: { type: String, required: true, unique: true, immutable: true },
  role: { type: String, default: '' },
  experienceLevel: { type: String, default: '' },
  bio: { type: String, default: '' },
  techStack: { type: [String], default: [] },
  helpWanted: { type: String, default: '' },
  github: { type: String, default: '' },
  linkedin: { type: String, default: '' },
  website: { type: String, default: '' },
  blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  reports: [
    {
      reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reason: { type: String, default: '' },
      date: { type: Date, default: Date.now }
    }
  ]
});

userSchema.pre('validate', function(next) {
  if (!this.uniqueId) {
    this.uniqueId = generateUniqueId(10);
  }
  next();
});

module.exports = mongoose.model('User', userSchema); 