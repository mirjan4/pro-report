const express = require('express');
const router = express.Router();
const Collection = require('../models/Collection');
const Pro = require('../models/Pro');
const FinancialYear = require('../models/FinancialYear');
const { protect } = require('../middleware/auth');

const MONTHS = ['April','May','June','July','August','September','October','November','December','January','February','March'];

router.get('/full-data', protect, async (req, res) => {
  try {
    const { financialYear } = req.query;
    let fyId = financialYear;
    if (!fyId) { const activeFY = await FinancialYear.findOne({ isActive: true }); fyId = activeFY?._id; }
    const [currentFY, collections, pros] = await Promise.all([
      FinancialYear.findById(fyId),
      Collection.find({ financialYear: fyId }).sort({ monthIndex: 1, proName: 1 }),
      Pro.find({}).sort({ name: 1 })
    ]);
    const proSummaries = pros.map(pro => {
      const proCols = collections.filter(c => c.pro.toString() === pro._id.toString());
      const total = proCols.reduce((s, c) => s + c.totalAmount, 0);
      const global = proCols.reduce((s, c) => s + c.globalAmount, 0);
      const proAmt = proCols.reduce((s, c) => s + c.proAmount, 0);
      const office = proCols.reduce((s, c) => s + c.officeAmount, 0);
      return { name: pro.name, area: pro.area, status: pro.status, total, global, pro: proAmt, office };
    }).sort((a, b) => b.total - a.total).map((p, i) => ({ ...p, rank: p.total > 0 ? i + 1 : '-' }));
    const monthlyTotals = MONTHS.map(month => {
      const cols = collections.filter(c => c.month === month);
      return { month, total: cols.reduce((s, c) => s + c.totalAmount, 0), global: cols.reduce((s, c) => s + c.globalAmount, 0), pro: cols.reduce((s, c) => s + c.proAmount, 0), office: cols.reduce((s, c) => s + c.officeAmount, 0) };
    });
    const grandTotal = {
      total: collections.reduce((s, c) => s + c.totalAmount, 0),
      global: collections.reduce((s, c) => s + c.globalAmount, 0),
      pro: collections.reduce((s, c) => s + c.proAmount, 0),
      office: collections.reduce((s, c) => s + c.officeAmount, 0)
    };
    res.json({ success: true, data: { fyLabel: currentFY?.label, fyYear: currentFY?.year, generatedAt: new Date().toISOString(), proSummaries, monthlyTotals, grandTotal, rawCollections: collections } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
