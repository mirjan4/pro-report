const mongoose = require('mongoose');

const MONTHS = ['April','May','June','July','August','September','October','November','December','January','February','March'];
const MONTHS_CALENDAR_MAP = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const sponsorSchema = new mongoose.Schema({
  month: { type: String, required: true },
  monthIndex: { type: Number },
  year: { type: Number, required: true },
  financialYearLabel: { type: String },
  date: { type: Date },
  pro: { type: mongoose.Schema.Types.ObjectId, ref: 'Pro', required: true },
  proName: { type: String },
  premiumCount: { type: Number, default: 0, min: 0 },
  smartCount: { type: Number, default: 0, min: 0 },
  standardCount: { type: Number, default: 0, min: 0 },
  totalSponsors: { type: Number, default: 0 },
  notes: { type: String },
  enteredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

sponsorSchema.pre('save', function(next) {
  this.totalSponsors = (this.premiumCount || 0) + (this.smartCount || 0) + (this.standardCount || 0);

  if (this.month && this.year) {
    const mIdx = MONTHS.indexOf(this.month);
    this.monthIndex = mIdx;

    let startYear;
    if (mIdx >= 0 && mIdx <= 8) { // April to December
      startYear = this.year;
    } else { // January to March
      startYear = this.year - 1;
    }
    const endYear = startYear + 1;
    this.financialYearLabel = `FY ${startYear}-${String(endYear).substring(2)}`;

    const calendarMonthIdx = MONTHS_CALENDAR_MAP.indexOf(this.month);
    this.date = new Date(Date.UTC(this.year, calendarMonthIdx, 1));
  }
  next();
});

// Enforce unique constraints: at most one record per PRO recruiter per month/year
sponsorSchema.index({ pro: 1, month: 1, year: 1 }, { unique: true });
sponsorSchema.index({ date: 1 });

module.exports = mongoose.model('Sponsor', sponsorSchema);
