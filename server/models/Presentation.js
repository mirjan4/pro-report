const mongoose = require('mongoose');

const PresentationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  collectionFilter: {
    type: String,
    enum: ['all', 'pro', 'ofc', 'glb'],
    default: 'all'
  },
  periodType: {
    type: String,
    enum: ['monthly', 'yearly', 'financialYear', 'custom'],
    default: 'monthly'
  },
  customRange: {
    startDate: { type: String },
    endDate: { type: String }
  },
  financialYear: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FinancialYear'
  },
  module: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Module'
  },
  slides: [{
    id: { type: String, required: true },
    title: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    order: { type: Number, required: true }
  }],
  accessControl: {
    isPublic: { type: Boolean, default: true },
    isPasswordProtected: { type: Boolean, default: false },
    password: { type: String }, // Hashed password
    expiresAt: { type: Date }
  },
  liveData: {
    type: Boolean,
    default: true
  },
  snapshotData: {
    type: mongoose.Schema.Types.Mixed // Frozen data at generation time
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Presentation', PresentationSchema);
