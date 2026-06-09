const mongoose = require('mongoose');

const proSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  designation: { type: String, trim: true, default: 'PRO Officer' },
  area: { type: String, trim: true },
  mobile: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  joinedDate: { type: Date, default: Date.now },
  notes: { type: String },
  module: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

proSchema.index({ name: 'text', area: 'text' });
proSchema.index({ module: 1, status: 1 });

module.exports = mongoose.model('Pro', proSchema);
