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

// DB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB Connected');
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch(err => { console.error('❌ MongoDB Connection Error:', err); process.exit(1); });

module.exports = app;
