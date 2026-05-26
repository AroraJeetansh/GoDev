const User = require('../models/User');

const updateProfile = async (req, res) => {
  try {
    const user = req.user; // Populated by authenticateToken middleware
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Parse and update fields from request body
    if ('name' in req.body) user.name = req.body.name;
    if ('role' in req.body) user.role = req.body.role;
    if ('experienceLevel' in req.body) user.experienceLevel = req.body.experienceLevel;
    if ('bio' in req.body) user.bio = req.body.bio;
    if ('techStack' in req.body) {
      try {
        user.techStack = typeof req.body.techStack === 'string' ? JSON.parse(req.body.techStack || '[]') : req.body.techStack;
      } catch (e) {
        user.techStack = [];
      }
    }
    if ('helpWanted' in req.body) user.helpWanted = req.body.helpWanted;
    if ('github' in req.body) user.github = req.body.github;
    if ('linkedin' in req.body) user.linkedin = req.body.linkedin;
    if ('website' in req.body) user.website = req.body.website;
    if ('avatar' in req.body) user.avatar = req.body.avatar;

    await user.save();
    res.json({ user });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

const blockUser = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { targetUserId } = req.body;
    if (!targetUserId) {
      return res.status(400).json({ error: 'Target user ID required' });
    }

    if (!user.blockedUsers.includes(targetUserId)) {
      user.blockedUsers.push(targetUserId);
      await user.save();
    }

    res.json({ success: true, message: 'User blocked successfully' });
  } catch (err) {
    console.error('Block user error:', err);
    res.status(500).json({ error: 'Failed to block user' });
  }
};

const reportUser = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { targetUserId, reason } = req.body;
    if (!targetUserId) {
      return res.status(400).json({ error: 'Target user ID required' });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    targetUser.reports.push({
      reportedBy: user._id,
      reason: reason || 'Unspecified reason',
      date: new Date()
    });

    await targetUser.save();

    res.json({ success: true, message: 'User reported successfully' });
  } catch (err) {
    console.error('Report user error:', err);
    res.status(500).json({ error: 'Failed to report user' });
  }
};

const getPublicProfile = async (req, res) => {
  try {
    const { uniqueId } = req.params;
    // Minimize sent data fields for security & privacy
    const user = await User.findOne({ uniqueId }).select(
      '_id name avatar role experienceLevel bio techStack helpWanted github linkedin website uniqueId'
    );
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (err) {
    console.error('Get public profile error:', err);
    res.status(500).json({ error: 'Failed to get profile' });
  }
};

const searchUsers = async (req, res) => {
  try {
    const q = req.query.q || '';
    if (!q.trim()) {
      return res.json({ users: [] });
    }
    const regex = new RegExp(q, 'i');
    const users = await User.find({
      $or: [
        { name: regex },
        { email: regex },
        { uniqueId: regex }
      ]
    }).select('_id name email uniqueId avatar');
    res.json({ users });
  } catch (err) {
    console.error('Search users error:', err);
    res.status(500).json({ error: 'Failed to search users' });
  }
};

module.exports = {
  updateProfile,
  blockUser,
  reportUser,
  getPublicProfile,
  searchUsers,
};
