const mongoose = require('mongoose');

const financialYearSchema = new mongoose.Schema({
  year: { type: String, required: true, unique: true, trim: true },
  startYear: { type: Number, required: true },
  endYear: { type: Number, required: true },
  isActive: { type: Boolean, default: false },
  isArchived: { type: Boolean, default: false },
  label: { type: String },
  description: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

financialYearSchema.pre('save', function(next) {
  if (!this.label) this.label = `Financial Year ${this.year}`;
  next();
});

module.exports = mongoose.model('FinancialYear', financialYearSchema);
