const mongoose = require('mongoose');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const User = require('./models/User');

async function seed() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is missing.');
    }

    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to database.');

    // Generate a secure random temporary password (10 hex characters)
    const tempPassword = crypto.randomBytes(5).toString('hex');
    const username = 'analytics';

    let user = await User.findOne({ username });

    if (user) {
      console.log(`User "${username}" already exists. Updating password and setting force change flag...`);
      user.password = tempPassword;
      user.needsPasswordChange = true;
      user.fullName = 'Analytics Viewer';
      user.role = 'analytics';
      user.isActive = true;
      await user.save();
    } else {
      console.log(`Creating new "${username}" user...`);
      user = new User({
        username,
        password: tempPassword,
        role: 'analytics',
        fullName: 'Analytics Viewer',
        needsPasswordChange: true,
        isActive: true
      });
      await user.save();
    }

    console.log('\n==================================================');
    console.log('   ANALYTICS VIEWER USER CREATED / RESET SUCCESS   ');
    console.log('==================================================');
    console.log(`Username:  ${username}`);
    console.log(`Password:  ${tempPassword}`);
    console.log('Note:      Password change is FORCED on first login.');
    console.log('==================================================\n');

  } catch (err) {
    console.error('Seeding failed:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from database.');
  }
}

seed();
