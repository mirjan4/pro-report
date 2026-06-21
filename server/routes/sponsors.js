const express = require('express');
const router = express.Router();
const Sponsor = require('../models/Sponsor');
const Pro = require('../models/Pro');
const Module = require('../models/Module');
const { protect, adminOnly } = require('../middleware/auth');

const MONTHS = ['April','May','June','July','August','September','October','November','December','January','February','March'];

function getFYDateRange(fyId) {
  if (!fyId || fyId === 'all') {
    const startDate = new Date(Date.UTC(2000, 0, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(2100, 11, 31, 23, 59, 59, 999));
    return { startDate, endDate };
  }
  const startYear = parseInt(fyId);
  const endYear = startYear + 1;
  const startDate = new Date(Date.UTC(startYear, 3, 1, 0, 0, 0)); // April 1
  const endDate = new Date(Date.UTC(endYear, 2, 31, 23, 59, 59, 999)); // March 31
  return { startDate, endDate };
}

// Helper to safely extract IDs
function getProId(p) {
  if (!p) return '';
  return p._id ? p._id.toString() : p.toString();
}

// GET /api/sponsors — list monthly sponsor count records
router.get('/', protect, async (req, res) => {
  try {
    const { financialYear, month, year, pro, page = 1, limit = 200 } = req.query;
    const filter = {};

    if (financialYear && financialYear !== 'all') {
      const { startDate, endDate } = getFYDateRange(financialYear);
      filter.date = { $gte: startDate, $lte: endDate };
    }

    if (month) filter.month = month;
    if (year) filter.year = Number(year);
    if (pro) filter.pro = pro;

    const total = await Sponsor.countDocuments(filter);
    const sponsors = await Sponsor.find(filter)
      .populate({
        path: 'pro',
        select: 'name area status module',
        populate: { path: 'module', select: 'name code color' }
      })
      .sort({ date: 1, proName: 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    res.json({ success: true, data: sponsors, total });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/sponsors/analytics — aggregate sponsor counts, KPIs, and charts
router.get('/analytics', protect, async (req, res) => {
  try {
    const { financialYear, pro: proId } = req.query;
    let fyId = financialYear || 'all';

    const filter = {};
    if (fyId !== 'all') {
      const { startDate, endDate } = getFYDateRange(fyId);
      filter.date = { $gte: startDate, $lte: endDate };
    }
    if (proId) {
      filter.pro = proId;
    }

    const [sponsorsList, pros] = await Promise.all([
      Sponsor.find(filter)
        .populate({
          path: 'pro',
          populate: { path: 'module' }
        })
        .lean(),
      Pro.find({}).populate('module').lean()
    ]);

    // 1. Dashboard KPIs
    const premiumCount = sponsorsList.reduce((s, c) => s + (c.premiumCount || 0), 0);
    const smartCount = sponsorsList.reduce((s, c) => s + (c.smartCount || 0), 0);
    const standardCount = sponsorsList.reduce((s, c) => s + (c.standardCount || 0), 0);
    const totalSponsors = sponsorsList.reduce((s, c) => s + (c.totalSponsors || 0), 0);

    // 2. Monthly New Sponsors Summary
    const monthlySummary = MONTHS.map((month) => {
      const monthRecs = sponsorsList.filter(c => c.month === month);
      return {
        month,
        premium: monthRecs.reduce((s, c) => s + (c.premiumCount || 0), 0),
        smart: monthRecs.reduce((s, c) => s + (c.smartCount || 0), 0),
        standard: monthRecs.reduce((s, c) => s + (c.standardCount || 0), 0),
        total: monthRecs.reduce((s, c) => s + (c.totalSponsors || 0), 0)
      };
    });

    // 3. Sponsors by Category (PRO vs Office)
    let proSponsors = 0;
    let officeSponsors = 0;
    sponsorsList.forEach(c => {
      if (c.pro && c.pro.module) {
        const code = c.pro.module.code || '';
        if (code === 'pro') {
          proSponsors += (c.totalSponsors || 0);
        } else if (code === 'ofc' || code === 'office') {
          officeSponsors += (c.totalSponsors || 0);
        }
      }
    });

    // 4. Recruiters Rankings & Top Recruiters
    const proMap = {};
    pros.forEach(p => {
      proMap[p._id.toString()] = {
        proId: p._id.toString(),
        name: p.name,
        area: p.area || 'N/A',
        status: p.status,
        premium: 0,
        smart: 0,
        standard: 0,
        total: 0,
        category: p.module?.name || 'N/A'
      };
    });

    sponsorsList.forEach(c => {
      if (!c.pro) return;
      const pid = getProId(c.pro);
      if (proMap[pid]) {
        proMap[pid].premium += (c.premiumCount || 0);
        proMap[pid].smart += (c.smartCount || 0);
        proMap[pid].standard += (c.standardCount || 0);
        proMap[pid].total += (c.totalSponsors || 0);
      }
    });

    const recruiterRankings = Object.values(proMap)
      .sort((a, b) => b.total - a.total)
      .map((r, idx) => ({ ...r, rank: idx + 1 }));

    const topRecruiters = recruiterRankings.filter(r => r.total > 0).slice(0, 10);

    // 5. Sponsor Growth Trend (cumulative count)
    let cumulative = 0;
    const growthTrend = monthlySummary.map(m => {
      cumulative += m.total;
      return {
        month: m.month,
        added: m.total,
        cumulative
      };
    });

    res.json({
      success: true,
      data: {
        kpis: { totalSponsors, premiumCount, smartCount, standardCount },
        monthlySummary,
        byCategory: { proSponsors, officeSponsors },
        recruiterRankings,
        topRecruiters,
        growthTrend
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/sponsors — record monthly sponsor counts
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { month, year, pro: proId, premiumCount, smartCount, standardCount, notes } = req.body;
    if (!month || !year || !proId) {
      return res.status(400).json({ success: false, message: 'Please provide month, year, and PRO officer/office' });
    }

    const proDoc = await Pro.findById(proId);
    if (!proDoc) return res.status(404).json({ success: false, message: 'PRO not found' });

    // Enforce uniqueness
    const existing = await Sponsor.findOne({ pro: proId, month, year: Number(year) });
    if (existing) {
      return res.status(400).json({ success: false, message: `A sponsor record already exists for this PRO/Office for ${month} ${year}.` });
    }

    const sponsor = await Sponsor.create({
      month,
      year: Number(year),
      pro: proId,
      proName: proDoc.name,
      premiumCount: Number(premiumCount) || 0,
      smartCount: Number(smartCount) || 0,
      standardCount: Number(standardCount) || 0,
      notes,
      enteredBy: req.user._id
    });

    res.status(201).json({ success: true, data: sponsor });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PUT /api/sponsors/:id — update entry
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { month, year, premiumCount, smartCount, standardCount, notes } = req.body;
    const sponsor = await Sponsor.findById(req.params.id);
    if (!sponsor) return res.status(404).json({ success: false, message: 'Sponsor record not found' });

    const newMonth = month || sponsor.month;
    const newYear = year ? Number(year) : sponsor.year;

    if (newMonth !== sponsor.month || newYear !== sponsor.year) {
      const existing = await Sponsor.findOne({
        _id: { $ne: sponsor._id },
        pro: sponsor.pro,
        month: newMonth,
        year: newYear
      });
      if (existing) {
        return res.status(400).json({ success: false, message: `A sponsor record already exists for this PRO/Office for ${newMonth} ${newYear}.` });
      }
      sponsor.month = newMonth;
      sponsor.year = newYear;
    }

    if (premiumCount !== undefined) sponsor.premiumCount = Number(premiumCount) || 0;
    if (smartCount !== undefined) sponsor.smartCount = Number(smartCount) || 0;
    if (standardCount !== undefined) sponsor.standardCount = Number(standardCount) || 0;
    if (notes !== undefined) sponsor.notes = notes;

    await sponsor.save();
    res.json({ success: true, data: sponsor });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// DELETE /api/sponsors/bulk — bulk delete
router.delete('/bulk', protect, adminOnly, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide an array of IDs' });
    }
    const result = await Sponsor.deleteMany({ _id: { $in: ids } });
    res.json({ success: true, message: `Successfully deleted ${result.deletedCount} sponsor record(s).` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/sponsors/:id — delete entry
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await Sponsor.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Sponsor record deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/sponsors/bulk — bulk import counts
router.post('/bulk', protect, adminOnly, async (req, res) => {
  try {
    const { entries, skipDuplicates = true } = req.body;
    const results = { inserted: 0, updated: 0, skipped: 0, failed: 0, errors: [] };

    for (const entry of entries) {
      try {
        const proDoc = await Pro.findById(entry.pro);
        if (!proDoc) throw new Error(`PRO/Office not found for ID: ${entry.pro}`);

        const filter = {
          pro: entry.pro,
          month: entry.month,
          year: Number(entry.year)
        };

        const existing = await Sponsor.findOne(filter);
        if (existing && skipDuplicates) {
          results.skipped++;
          continue;
        }

        const update = {
          proName: proDoc.name,
          premiumCount: Number(entry.premiumCount) || 0,
          smartCount: Number(entry.smartCount) || 0,
          standardCount: Number(entry.standardCount) || 0,
          notes: entry.notes || '',
          enteredBy: req.user._id
        };

        if (existing) {
          Object.assign(existing, update);
          await existing.save();
          results.updated++;
        } else {
          await Sponsor.create({ ...filter, ...update });
          results.inserted++;
        }
      } catch (e) {
        results.failed++;
        results.errors.push({ entry, error: e.message });
      }
    }
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
