const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.RENDER_EXTERNAL_URL,
  'http://localhost:3000'
].filter(Boolean);
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/modules', require('./routes/modules'));
app.use('/api/pros', require('./routes/pros'));
app.use('/api/financial-years', require('./routes/financialYears'));
app.use('/api/collections', require('./routes/collections'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/sponsors', require('./routes/sponsors'));
app.use('/api/collection-heads', require('./routes/collectionHeads'));
app.use('/api/distribution-heads', require('./routes/distributionHeads'));
app.use('/api/distributions', require('./routes/distributions'));
app.use('/api/presentations', require('./routes/presentations'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Serve React frontend in production or if client/dist is present
const clientBuild = path.join(__dirname, '..', 'client', 'dist');
const fs = require('fs');

if (process.env.NODE_ENV === 'production' || fs.existsSync(clientBuild)) {
  app.use(express.static(clientBuild));
  // All non-API routes → React index.html (client-side routing)
  app.get('*', (req, res) => {
    const indexPath = path.join(clientBuild, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({ success: false, message: 'Route not found' });
    }
  });
} else {
  // 404 for API-only dev mode
  app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
}

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Server Error' });
});

// Migration check function
async function checkMigration() {
  try {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const hasCollections = collections.some(col => col.name === 'collections');
    if (hasCollections) {
      const coll = db.collection('collections');
      const indexes = await coll.indexes();
      const targetIndexName = 'module_1_financialYear_1_month_1_pro_1';
      const indexExists = indexes.some(idx => idx.name === targetIndexName);
      if (indexExists) {
        console.warn(`⚠️ WARNING: Legacy unique index "${targetIndexName}" still exists in the database. This index is deprecated and will cause duplicate key errors on collections. Please drop it.`);
      }
    }
  } catch (err) {
    console.error('Error running migration startup check:', err);
  }
}

// Seed default Additional Collection Heads if none exist
async function seedCollectionHeads() {
  try {
    const CollectionHead = require('./models/CollectionHead');
    const count = await CollectionHead.countDocuments();
    if (count === 0) {
      console.log('🌱 Seeding default Additional Collection Heads...');
      await CollectionHead.insertMany([
        { name: 'Markaz', isActive: true },
        { name: 'Orphanage', isActive: true },
        { name: 'Other', isActive: true }
      ]);
      console.log('✅ Default Additional Collection Heads seeded successfully');
    }
  } catch (err) {
    console.error('Failed to seed default Additional Collection Heads:', err);
  }
}

// Seed default Distribution Heads if none exist
async function seedDistributionHeads() {
  try {
    const DistributionHead = require('./models/DistributionHead');
    const count = await DistributionHead.countDocuments();
    if (count === 0) {
      console.log('🌱 Seeding default Distribution Heads...');
      const defaults = [
        'Food', 'Rice', 'Eid Food Kit', 'Iftar', 'Orphanage', 
        'Green Valley', 'Peralassery', 'Madaniyam', 'Darul Rashad', 
        'Kitchen Work', 'Kathmul Bukhari'
      ];
      await DistributionHead.insertMany(defaults.map(name => ({ name, isActive: true })));
      console.log('✅ Default Distribution Heads seeded successfully');
    }
  } catch (err) {
    console.error('Failed to seed default Distribution Heads:', err);
  }
}

// DB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ MongoDB Connected');
    await checkMigration();
    await seedCollectionHeads();
    await seedDistributionHeads();
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch(err => { console.error('❌ MongoDB Connection Error:', err); process.exit(1); });

module.exports = app;
