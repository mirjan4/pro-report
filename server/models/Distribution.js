const mongoose = require('mongoose');

const MONTHS = ['April','May','June','July','August','September','October','November','December','January','February','March'];
const MONTHS_CALENDAR_MAP = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const distributionSchema = new mongoose.Schema({
  month: { type: String, required: true },
  year: { type: Number, required: true },
  date: { type: Date },
  distributions: [{
    head: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 }
  }],
  enteredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Enforce unique distribution sheet per month/year
distributionSchema.index({ month: 1, year: 1 }, { unique: true });
distributionSchema.index({ date: 1 });

distributionSchema.pre('save', function(next) {
  if (this.month && this.year) {
    const calendarMonthIdx = MONTHS_CALENDAR_MAP.indexOf(this.month);
    this.date = new Date(Date.UTC(this.year, calendarMonthIdx, 1));
  }
  next();
});

module.exports = mongoose.model('Distribution', distributionSchema);
