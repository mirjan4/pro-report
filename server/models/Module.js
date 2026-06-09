const mongoose = require('mongoose');

const moduleSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, unique: true, lowercase: true, trim: true }, // e.g. 'pro', 'global', 'office'
  description: { type: String, trim: true },
  icon: { type: String, default: 'layers' }, // lucide icon name
  color: { type: String, default: '#d4af37' }, // accent color
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Module', moduleSchema);
