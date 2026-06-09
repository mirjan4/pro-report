const express = require('express');
const router = express.Router();
const Collection = require('../models/Collection');
const Pro = require('../models/Pro');
const FinancialYear = require('../models/FinancialYear');
const Module = require('../models/Module');
const { protect } = require('../middleware/auth');

const MONTHS = ['April','May','June','July','August','September','October','November','December','January','February','March'];

async function getModuleCollections(financialYearId, moduleId) {
  const filter = { financialYear: financialYearId };
  if (moduleId) filter.module = moduleId;
  return Collection.find(filter);
}

// GET /api/analytics/kpi?financialYear=id&module=id
router.get('/kpi', protect, async (req, res) => {
  try {
    const { financialYear, module: moduleId } = req.query;
    let fyId = financialYear;
    if (!fyId) { const activeFY = await FinancialYear.findOne({ isActive: true }); fyId = activeFY?._id; }
    if (!fyId) return res.json({ success: true, data: {} });

    const collections = await getModuleCollections(fyId, moduleId);
    const total = collections.reduce((s, c) => s + c.totalAmount, 0);

    const currentFY = await FinancialYear.findById(fyId);
    let growthPct = 0, prevTotal = 0;
    if (currentFY) {
      const prevFY = await FinancialYear.findOne({ startYear: currentFY.startYear - 1 });
      if (prevFY) {
        const prevCols = await getModuleCollections(prevFY._id, moduleId);
        prevTotal = prevCols.reduce((s, c) => s + c.totalAmount, 0);
        growthPct = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0;
      }
    }

    const proFilter = { status: 'active' };
    if (moduleId) proFilter.module = moduleId;
    const activePros = await Pro.countDocuments(proFilter);
    const contributingPros = [...new Set(collections.map(c => c.pro.toString()))].length;

    res.json({ success: true, data: {
      total, growthPct: Math.round(growthPct * 100) / 100,
      prevTotal, activePros, contributingPros,
      zeroPros: activePros - contributingPros, fyLabel: currentFY?.label
    }});
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/analytics/monthly?financialYear=id&module=id
router.get('/monthly', protect, async (req, res) => {
  try {
    const { financialYear, module: moduleId } = req.query;
    let fyId = financialYear;
    if (!fyId) { const activeFY = await FinancialYear.findOne({ isActive: true }); fyId = activeFY?._id; }
    const collections = await getModuleCollections(fyId, moduleId);
    const monthlyData = MONTHS.map((month, idx) => {
      const monthCols = collections.filter(c => c.month === month);
      return {
        month, index: idx,
        total: monthCols.reduce((s, c) => s + c.totalAmount, 0),
        amount: monthCols.reduce((s, c) => s + c.amount, 0),
        count: monthCols.length
      };
    });
    const totals = monthlyData.map(m => m.total);
    const maxVal = Math.max(...totals);
    const nonZero = totals.filter(t => t > 0);
    const minVal = nonZero.length ? Math.min(...nonZero) : 0;
    res.json({ success: true, data: {
      monthlyData,
      highestMonth: monthlyData.find(m => m.total === maxVal),
      lowestMonth: monthlyData.find(m => m.total === minVal)
    }});
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/analytics/category?financialYear=id
// Returns breakdown per module for the given year
router.get('/category', protect, async (req, res) => {
  try {
    const { financialYear } = req.query;
    let fyId = financialYear;
    if (!fyId) { const activeFY = await FinancialYear.findOne({ isActive: true }); fyId = activeFY?._id; }
    const [collections, modules] = await Promise.all([
      Collection.find({ financialYear: fyId }),
      Module.find({ isActive: true }).sort({ sortOrder: 1, name: 1 })
    ]);
    const total = collections.reduce((s, c) => s + c.totalAmount, 0);
    const breakdown = modules.map(mod => {
      const modCols = collections.filter(c => c.module.toString() === mod._id.toString());
      const value = modCols.reduce((s, c) => s + c.totalAmount, 0);
      return { name: mod.name, code: mod.code, color: mod.color, value, pct: total > 0 ? (value / total * 100).toFixed(1) : 0 };
    });
    res.json({ success: true, data: breakdown });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/analytics/rankings?financialYear=id&module=id
router.get('/rankings', protect, async (req, res) => {
  try {
    const { financialYear, module: moduleId } = req.query;
    let fyId = financialYear;
    if (!fyId) { const activeFY = await FinancialYear.findOne({ isActive: true }); fyId = activeFY?._id; }
    const collections = await getModuleCollections(fyId, moduleId);
    const currentFY = await FinancialYear.findById(fyId);
    let prevCollections = [];
    if (currentFY) {
      const prevFY = await FinancialYear.findOne({ startYear: currentFY.startYear - 1 });
      if (prevFY) prevCollections = await getModuleCollections(prevFY._id, moduleId);
    }

    const proMap = {};
    for (const c of collections) {
      const pid = c.pro.toString();
      if (!proMap[pid]) proMap[pid] = { proId: pid, name: c.proName, total: 0 };
      proMap[pid].total += c.totalAmount;
    }
    const prevMap = {};
    for (const c of prevCollections) {
      const pid = c.pro.toString();
      if (!prevMap[pid]) prevMap[pid] = 0;
      prevMap[pid] += c.totalAmount;
    }

    const proFilter = {};
    if (moduleId) proFilter.module = moduleId;
    const pros = await Pro.find(proFilter);
    const proStatusMap = {};
    pros.forEach(p => proStatusMap[p._id.toString()] = p.status);

    let rankings = Object.values(proMap)
      .map(p => {
        const prev = prevMap[p.proId] || 0;
        const growth = prev > 0 ? ((p.total - prev) / prev * 100) : (p.total > 0 ? 100 : 0);
        return { ...p, prevTotal: prev, growth: Math.round(growth * 100) / 100, status: proStatusMap[p.proId] || 'active' };
      })
      .sort((a, b) => b.total - a.total)
      .map((p, i) => ({ ...p, rank: i + 1 }));

    const contributingIds = new Set(Object.keys(proMap));
    const zeroPros = pros.filter(p => !contributingIds.has(p._id.toString()))
      .map(p => ({ proId: p._id.toString(), name: p.name, total: 0, rank: null, status: p.status, growth: 0 }));

    res.json({ success: true, data: { rankings, zeroPros, totalPros: pros.length } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/analytics/pro/:proId?financialYear=id&module=id&month=MonthName
router.get('/pro/:proId', protect, async (req, res) => {
  try {
    const { financialYear, module: moduleId, month: filterMonth } = req.query;
    let fyId = financialYear;
    if (!fyId) { const activeFY = await FinancialYear.findOne({ isActive: true }); fyId = activeFY?._id; }

    const colFilter = { financialYear: fyId, pro: req.params.proId };
    if (moduleId) colFilter.module = moduleId;
    // If a specific month is requested, scope collections to that month only
    if (filterMonth && MONTHS.includes(filterMonth)) colFilter.month = filterMonth;

    const [pro, collections] = await Promise.all([
      Pro.findById(req.params.proId).populate('module', 'name code color'),
      Collection.find(colFilter).sort({ monthIndex: 1 })
    ]);
    if (!pro) return res.status(404).json({ success: false, message: 'PRO not found' });

    const currentFY = await FinancialYear.findById(fyId);
    let prevCollections = [];
    if (currentFY) {
      const prevFY = await FinancialYear.findOne({ startYear: currentFY.startYear - 1 });
      if (prevFY) {
        const prevFilter = { financialYear: prevFY._id, pro: req.params.proId };
        if (moduleId) prevFilter.module = moduleId;
        if (filterMonth && MONTHS.includes(filterMonth)) prevFilter.month = filterMonth;
        prevCollections = await Collection.find(prevFilter).sort({ monthIndex: 1 });
      }
    }

    const total = collections.reduce((s, c) => s + c.totalAmount, 0);
    const prevTotal = prevCollections.reduce((s, c) => s + c.totalAmount, 0);
    const growth = prevTotal > 0 ? ((total - prevTotal) / prevTotal * 100) : (total > 0 ? 100 : 0);

    // Full monthly breakdown — always across all 12 months (needed for charts)
    // But only show actual data from the scoped collections
    const allColFilter = { financialYear: fyId, pro: req.params.proId };
    if (moduleId) allColFilter.module = moduleId;
    const allPrevFilter = { pro: req.params.proId };
    if (moduleId) allPrevFilter.module = moduleId;

    let allCollections = collections;
    let allPrevCollections = prevCollections;

    // If month filter applied, fetch full year collections separately for chart breakdown
    if (filterMonth) {
      allCollections = await Collection.find(allColFilter).sort({ monthIndex: 1 });
      if (currentFY) {
        const prevFY = await FinancialYear.findOne({ startYear: currentFY.startYear - 1 });
        if (prevFY) {
          allPrevFilter.financialYear = prevFY._id;
          allPrevCollections = await Collection.find(allPrevFilter).sort({ monthIndex: 1 });
        }
      }
    }

    const monthlyBreakdown = MONTHS.map((month, idx) => {
      const curr = allCollections.find(c => c.month === month);
      const prev = allPrevCollections.find(c => c.month === month);
      return { month, index: idx, current: curr?.totalAmount || 0, previous: prev?.totalAmount || 0, amount: curr?.amount || 0 };
    });

    const amounts = monthlyBreakdown.map(m => m.current);
    const maxAmt = Math.max(...amounts);
    const nonZero = amounts.filter(a => a > 0);
    const minAmt = nonZero.length ? Math.min(...nonZero) : 0;
    const filled = monthlyBreakdown.filter(m => m.current > 0);
    const recentAvg = filled.slice(-3).reduce((s, m) => s + m.current, 0) / (filled.slice(-3).length || 1);
    const earlyAvg = filled.slice(0, 3).reduce((s, m) => s + m.current, 0) / (filled.slice(0, 3).length || 1);
    const trend = recentAvg > earlyAvg ? 'improving' : recentAvg < earlyAvg ? 'declining' : 'stable';

    res.json({ success: true, data: {
      pro: pro.toObject(), total, prevTotal,
      growth: Math.round(growth * 100) / 100, monthlyBreakdown,
      peakMonth: monthlyBreakdown.find(m => m.current === maxAmt)?.month,
      lowestMonth: monthlyBreakdown.find(m => m.current === minAmt)?.month,
      trend, consistencyScore: (filled.length / 12 * 100).toFixed(0),
      filterMonth: filterMonth || null
    }});
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/analytics/comparison?year1=id&year2=id&module=id
router.get('/comparison', protect, async (req, res) => {
  try {
    const { year1, year2, module: moduleId } = req.query;
    if (!year1 || !year2) return res.status(400).json({ success: false, message: 'year1 and year2 required' });
    const [fy1, fy2, cols1, cols2] = await Promise.all([
      FinancialYear.findById(year1), FinancialYear.findById(year2),
      getModuleCollections(year1, moduleId), getModuleCollections(year2, moduleId)
    ]);

    // Monthly breakdown per PRO for each year
    const proIds = [...new Set([...cols1, ...cols2].map(c => c.pro.toString()))];
    const pros = await Pro.find({ _id: { $in: proIds } });
    const proNameMap = {};
    pros.forEach(p => proNameMap[p._id.toString()] = p.name);

    const monthly1 = MONTHS.map(m => ({ month: m, total: cols1.filter(c => c.month === m).reduce((s, c) => s + c.totalAmount, 0) }));
    const monthly2 = MONTHS.map(m => ({ month: m, total: cols2.filter(c => c.month === m).reduce((s, c) => s + c.totalAmount, 0) }));

    // Per-PRO monthly comparison
    const proMonthlyComparison = proIds.map(pid => {
      const name = proNameMap[pid] || pid;
      const yearData1 = MONTHS.map(m => ({ month: m, total: cols1.filter(c => c.pro.toString() === pid && c.month === m).reduce((s, c) => s + c.totalAmount, 0) }));
      const yearData2 = MONTHS.map(m => ({ month: m, total: cols2.filter(c => c.pro.toString() === pid && c.month === m).reduce((s, c) => s + c.totalAmount, 0) }));
      const t1 = yearData1.reduce((s, m) => s + m.total, 0);
      const t2 = yearData2.reduce((s, m) => s + m.total, 0);
      const growth = t1 > 0 ? ((t2 - t1) / t1 * 100) : (t2 > 0 ? 100 : 0);
      return { proId: pid, name, year1Monthly: yearData1, year2Monthly: yearData2, total1: t1, total2: t2, growth: Math.round(growth * 100) / 100 };
    });

    const total1 = cols1.reduce((s, c) => s + c.totalAmount, 0);
    const total2 = cols2.reduce((s, c) => s + c.totalAmount, 0);
    const diff = total2 - total1;
    const growthPct = total1 > 0 ? (diff / total1 * 100) : 0;

    res.json({ success: true, data: {
      year1: { label: fy1?.label, total: total1, monthly: monthly1 },
      year2: { label: fy2?.label, total: total2, monthly: monthly2 },
      diff, growthPct: Math.round(growthPct * 100) / 100,
      proMonthlyComparison
    }});
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/analytics/insights?financialYear=id&module=id
router.get('/insights', protect, async (req, res) => {
  try {
    const { financialYear, module: moduleId } = req.query;
    let fyId = financialYear;
    if (!fyId) { const activeFY = await FinancialYear.findOne({ isActive: true }); fyId = activeFY?._id; }

    const proFilter = {};
    if (moduleId) proFilter.module = moduleId;
    const [collections, pros, currentFY] = await Promise.all([
      getModuleCollections(fyId, moduleId), Pro.find(proFilter), FinancialYear.findById(fyId)
    ]);

    const total = collections.reduce((s, c) => s + c.totalAmount, 0);
    const proMap = {};
    for (const c of collections) {
      const pid = c.pro.toString();
      if (!proMap[pid]) proMap[pid] = { name: c.proName, total: 0 };
      proMap[pid].total += c.totalAmount;
    }
    const sorted = Object.values(proMap).sort((a, b) => b.total - a.total);
    const topPerformer = sorted[0];
    const activePros = pros.filter(p => p.status === 'active');
    const contributingIds = new Set(Object.keys(proMap));
    const zeroPros = activePros.filter(p => !contributingIds.has(p._id.toString()));

    const monthlyTotals = MONTHS.map(m => collections.filter(c => c.month === m).reduce((s, c) => s + c.totalAmount, 0));
    const nonZeroMonths = monthlyTotals.filter(t => t > 0);
    const avg = nonZeroMonths.reduce((s, t) => s + t, 0) / (nonZeroMonths.length || 1);
    const aboveAvg = nonZeroMonths.filter(t => t > avg).length;

    res.json({ success: true, data: {
      keyFindings: [
        `Total collection stands at ₹${total.toLocaleString('en-IN')} for ${currentFY?.label}`,
        topPerformer ? `Top performer is ${topPerformer.name} with ₹${topPerformer.total.toLocaleString('en-IN')}` : null,
        `${contributingIds.size} out of ${activePros.length} active PROs have contributed`,
        `${aboveAvg} months recorded above-average collection`
      ].filter(Boolean),
      growthOpportunities: [
        zeroPros.length > 0 ? `${zeroPros.length} active PROs (${zeroPros.map(p => p.name).join(', ')}) have zero collection — immediate activation needed` : null,
        sorted.length > 1 ? `Bottom performers have significant headroom to match top performer ${topPerformer?.name}` : null,
        `Consistent monthly engagement across all PROs can improve total by estimated 15–25%`
      ].filter(Boolean),
      weakAreas: [
        zeroPros.length > 0 ? `${zeroPros.length} zero-collection PROs represent a critical gap` : null,
        nonZeroMonths.length < 12 ? `Only ${nonZeroMonths.length} months have collections — ${12 - nonZeroMonths.length} months with zero activity` : null,
        sorted.length > 1 && (sorted[0].total / (sorted[sorted.length - 1].total || 1)) > 5 ? 'High performance disparity between top and bottom PROs' : null
      ].filter(Boolean),
      recommendations: [
        ...zeroPros.map(p => `Activate and monitor ${p.name} — currently contributing zero`),
        `Set monthly targets for each PRO based on historical averages`,
        ...sorted.slice(-3).map(p => `Review performance plan for ${p.name}`)
      ].filter(Boolean).slice(0, 8)
    }});
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/analytics/monthly-comparison — detailed comparison, rankings, growth and trends
router.get('/monthly-comparison', protect, async (req, res) => {
  try {
    const { financialYear, module: moduleId, month: selectedMonth } = req.query;
    
    let fyId = financialYear;
    if (!fyId) {
      const activeFY = await FinancialYear.findOne({ isActive: true });
      fyId = activeFY?._id;
    }
    if (!fyId) return res.status(400).json({ success: false, message: 'Financial year not found' });

    const currentFY = await FinancialYear.findById(fyId);
    
    const query = { financialYear: fyId };
    if (moduleId) query.module = moduleId;
    
    const collections = await Collection.find(query);
    
    const proFilter = {};
    if (moduleId) proFilter.module = moduleId;
    const pros = await Pro.find(proFilter);
    const proMap = {};
    pros.forEach(p => {
      proMap[p._id.toString()] = {
        proId: p._id.toString(),
        name: p.name,
        designation: p.designation || 'PRO Officer',
        area: p.area || 'N/A',
        status: p.status,
        monthlyAmounts: MONTHS.reduce((acc, m) => {
          acc[m] = 0;
          return acc;
        }, {})
      };
    });
    
    collections.forEach(c => {
      const pid = c.pro.toString();
      if (proMap[pid]) {
        proMap[pid].monthlyAmounts[c.month] = c.totalAmount;
      }
    });

    const proList = Object.values(proMap);
    
    const targetMonth = selectedMonth || 'April';
    const rankings = proList
      .map(p => ({
        proId: p.proId,
        name: p.name,
        designation: p.designation,
        area: p.area,
        status: p.status,
        amount: p.monthlyAmounts[targetMonth] || 0
      }))
      .sort((a, b) => b.amount - a.amount)
      .map((p, idx) => ({ ...p, rank: idx + 1 }));

    const monthlyWinners = MONTHS.map(m => {
      let bestPro = null;
      let maxAmount = 0;
      
      proList.forEach(p => {
        const amt = p.monthlyAmounts[m] || 0;
        if (amt > maxAmount) {
          maxAmount = amt;
          bestPro = {
            proId: p.proId,
            name: p.name,
            designation: p.designation,
            area: p.area,
            amount: amt
          };
        }
      });
      
      return {
        month: m,
        winner: bestPro
      };
    });

    const monthIdx = MONTHS.indexOf(targetMonth);
    let prevMonth = null;
    let prevMonthTotal = 0;
    
    const currentMonthTotal = rankings.reduce((s, p) => s + p.amount, 0);

    if (monthIdx > 0) {
      prevMonth = MONTHS[monthIdx - 1];
      prevMonthTotal = proList.reduce((s, p) => s + (p.monthlyAmounts[prevMonth] || 0), 0);
    } else {
      if (currentFY) {
        const prevFY = await FinancialYear.findOne({ startYear: currentFY.startYear - 1 });
        if (prevFY) {
          const prevQuery = { financialYear: prevFY._id, month: 'March' };
          if (moduleId) prevQuery.module = moduleId;
          const prevCols = await Collection.find(prevQuery);
          prevMonthTotal = prevCols.reduce((s, c) => s + c.totalAmount, 0);
        }
      }
      prevMonth = 'March (Prev FY)';
    }

    const growthDiff = currentMonthTotal - prevMonthTotal;
    const growthPct = prevMonthTotal > 0 ? (growthDiff / prevMonthTotal) * 100 : (currentMonthTotal > 0 ? 100 : 0);

    res.json({
      success: true,
      data: {
        financialYearLabel: currentFY?.label || '',
        selectedMonth: targetMonth,
        rankings,
        monthlyWinners,
        growthAnalysis: {
          currentMonth: targetMonth,
          prevMonth,
          currentTotal: currentMonthTotal,
          prevTotal: prevMonthTotal,
          diff: growthDiff,
          pct: Math.round(growthPct * 100) / 100
        },
        allProsTrend: proList
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
