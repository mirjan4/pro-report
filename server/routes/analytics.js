const express = require('express');
const router = express.Router();
const Collection = require('../models/Collection');
const Pro = require('../models/Pro');
const Module = require('../models/Module');
const { protect } = require('../middleware/auth');

const MONTHS = ['April','May','June','July','August','September','October','November','December','January','February','March'];

function getModuleId(m) {
  if (!m) return '';
  return m._id ? m._id.toString() : m.toString();
}

function getProId(p) {
  if (!p) return '';
  return p._id ? p._id.toString() : p.toString();
}

function getFYDateRange(fyId) {
  if (!fyId || fyId === 'all') {
    const startDate = new Date(Date.UTC(2000, 0, 1, 0, 0, 0)); // Very early start
    const endDate = new Date(Date.UTC(2100, 11, 31, 23, 59, 59, 999)); // Very late end
    return { startDate, endDate };
  }
  const startYear = parseInt(fyId);
  const endYear = startYear + 1;
  const startDate = new Date(Date.UTC(startYear, 3, 1, 0, 0, 0)); // April 1
  const endDate = new Date(Date.UTC(endYear, 2, 31, 23, 59, 59, 999)); // March 31
  return { startDate, endDate };
}

async function getModuleCollections(fyId, moduleId) {
  let filter = {};
  if (fyId && fyId !== 'all') {
    const { startDate, endDate } = getFYDateRange(fyId);
    filter.date = { $gte: startDate, $lte: endDate };
  }
  if (moduleId) filter.module = moduleId;
  return Collection.find(filter).populate('pro').populate('module').lean();
}

// GET /api/analytics/kpi?financialYear=id&module=id
router.get('/kpi', protect, async (req, res) => {
  try {
    const { financialYear, module: moduleId } = req.query;
    let fyId = financialYear || 'all';

    let currentFY;
    if (fyId === 'all') {
      currentFY = {
        _id: 'all',
        year: 'All Years',
        label: 'All Years',
        isActive: true
      };
    } else {
      const startYear = parseInt(fyId);
      const endYear = startYear + 1;
      currentFY = {
        _id: fyId,
        year: `${startYear}-${String(endYear).substring(2)}`,
        label: `${startYear}-${String(endYear).substring(2)}`,
        startYear,
        endYear,
        isActive: true
      };
    }

    // Fetch collections for all modules (for the KPI cards breakdown)
    const collectionsAll = await getModuleCollections(fyId, null);
    const totalAll = collectionsAll.reduce((s, c) => s + (c.totalAmount || 0), 0);

    // Fetch previous year collections for all modules
    let prevColsAll = [];
    let prevTotalAll = 0;
    if (fyId !== 'all' && currentFY && currentFY.startYear) {
      const prevStartYear = currentFY.startYear - 1;
      prevColsAll = await getModuleCollections(prevStartYear.toString(), null);
      prevTotalAll = prevColsAll.reduce((s, c) => s + (c.totalAmount || 0), 0);
    }

    // If moduleId is filtered, we compute total/prevTotal for that module
    const collections = moduleId 
      ? collectionsAll.filter(c => c.module && getModuleId(c.module) === moduleId.toString())
      : collectionsAll;
    const total = collections.reduce((s, c) => s + (c.totalAmount || 0), 0);

    const prevCols = moduleId
      ? prevColsAll.filter(c => c.module && getModuleId(c.module) === moduleId.toString())
      : prevColsAll;
    const prevTotal = prevCols.reduce((s, c) => s + (c.totalAmount || 0), 0);

    const growthPct = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0;
    const growthPctAll = prevTotalAll > 0 ? ((totalAll - prevTotalAll) / prevTotalAll) * 100 : 0;

    const proFilter = { status: 'active' };
    if (moduleId) proFilter.module = moduleId;
    const activePros = await Pro.countDocuments(proFilter);
    const contributingPros = [...new Set(collections.filter(c => c.pro).map(c => c.pro._id ? c.pro._id.toString() : c.pro.toString()))].length;

    // Calculate breakdown for all modules
    const modulesData = [];
    const modules = await Module.find({}).sort({ sortOrder: 1, name: 1 }).lean();
    modules.forEach(mod => {
      const modIdStr = mod._id.toString();
      const currModCols = collectionsAll.filter(c => c.module && getModuleId(c.module) === modIdStr);
      const currModSum = currModCols.reduce((s, c) => s + (c.totalAmount || 0), 0);

      const prevModCols = prevColsAll.filter(c => c.module && getModuleId(c.module) === modIdStr);
      const prevModSum = prevModCols.reduce((s, c) => s + (c.totalAmount || 0), 0);

      const modGrowth = prevModSum > 0 ? ((currModSum - prevModSum) / prevModSum) * 100 : 0;

      modulesData.push({
        _id: modIdStr,
        name: mod.name,
        code: mod.code,
        color: mod.color || '#d4af37',
        total: currModSum,
        prevTotal: prevModSum,
        growthPct: Math.round(modGrowth * 100) / 100
      });
    });

    res.json({ success: true, data: {
      total, growthPct: Math.round(growthPct * 100) / 100,
      prevTotal, activePros, contributingPros,
      zeroPros: Math.max(0, activePros - contributingPros), fyLabel: currentFY?.label,
      totalAll, prevTotalAll, growthPctAll: Math.round(growthPctAll * 100) / 100,
      modules: modulesData
    }});
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/analytics/monthly?financialYear=id&module=id
router.get('/monthly', protect, async (req, res) => {
  try {
    const { financialYear, module: moduleId } = req.query;
    let fyId = financialYear;
    if (!fyId) {
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();
      const startYear = currentMonth >= 3 ? currentYear : currentYear - 1;
      fyId = startYear.toString();
    }
    const collections = await getModuleCollections(fyId, moduleId);
    const monthlyData = MONTHS.map((month, idx) => {
      const monthCols = collections.filter(c => c.month === month);
      return {
        month, index: idx,
        total: monthCols.reduce((s, c) => s + (c.totalAmount || 0), 0),
        amount: monthCols.reduce((s, c) => s + (c.totalAmount || 0), 0),
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
router.get('/category', protect, async (req, res) => {
  try {
    const { financialYear } = req.query;
    let fyId = financialYear;
    if (!fyId) {
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();
      const startYear = currentMonth >= 3 ? currentYear : currentYear - 1;
      fyId = startYear.toString();
    }
    const [collections, modules] = await Promise.all([
      getModuleCollections(fyId, null),
      Module.find({}).sort({ sortOrder: 1, name: 1 })
    ]);
    const total = collections.reduce((s, c) => s + (c.totalAmount || 0), 0);
    const breakdown = modules.map(mod => {
      const modCols = collections.filter(c => c.module && getModuleId(c.module) === mod._id.toString());
      const value = modCols.reduce((s, c) => s + (c.totalAmount || 0), 0);
      return { name: mod.name, code: mod.code, color: mod.color, value, pct: total > 0 ? (value / total * 100).toFixed(1) : 0 };
    });
    res.json({ success: true, data: breakdown });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/analytics/category-monthly?financialYear=id&month=MonthName
router.get('/category-monthly', protect, async (req, res) => {
  try {
    const { financialYear, month: filterMonth } = req.query;
    let fyId = financialYear;
    if (!fyId) {
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();
      fyId = (currentMonth >= 3 ? currentYear : currentYear - 1).toString();
    }

    const [collections, modules] = await Promise.all([
      getModuleCollections(fyId, null),
      Module.find({ $or: [{ isActive: true }, { code: { $in: ['pro', 'ofc', 'glb', 'office', 'global'] } }] }).sort({ sortOrder: 1, name: 1 })
    ]);

    const grandTotal = collections.reduce((s, c) => s + (c.totalAmount || 0), 0);

    const categoryBreakdown = modules.map(mod => {
      const modCols = filterMonth
        ? collections.filter(c => c.module && getModuleId(c.module) === mod._id.toString() && c.month === filterMonth)
        : collections.filter(c => c.module && getModuleId(c.module) === mod._id.toString());
      const value = modCols.reduce((s, c) => s + (c.totalAmount || 0), 0);
      return {
        name: mod.name,
        code: mod.code,
        color: mod.color || '#d4af37',
        value,
        pct: grandTotal > 0 ? parseFloat((value / grandTotal * 100).toFixed(1)) : 0
      };
    });

    const monthlyByCategory = MONTHS.map(m => {
      const entry = { month: m };
      modules.forEach(mod => {
        const modMonthCols = collections.filter(c =>
          c.module && getModuleId(c.module) === mod._id.toString() && c.month === m
        );
        entry[mod.code] = modMonthCols.reduce((s, c) => s + (c.totalAmount || 0), 0);
        entry[`${mod.code}_name`] = mod.name;
        entry[`${mod.code}_color`] = mod.color || '#d4af37';
      });
      entry.total = modules.reduce((s, mod) => s + (entry[mod.code] || 0), 0);
      return entry;
    });

    const sortedCats = [...categoryBreakdown].sort((a, b) => b.value - a.value);
    const highest = sortedCats[0] || null;
    const lowest = sortedCats.filter(c => c.value > 0).pop() || null;

    res.json({
      success: true,
      data: {
        selectedMonth: filterMonth || 'All',
        categoryBreakdown,
        monthlyByCategory,
        grandTotal,
        highest,
        lowest,
        modules: modules.map(m => ({ _id: m._id, name: m.name, code: m.code, color: m.color || '#d4af37' }))
      }
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/analytics/rankings?financialYear=id&module=id
router.get('/rankings', protect, async (req, res) => {
  try {
    const { financialYear, module: moduleId } = req.query;
    let fyId = financialYear || 'all';
    const collections = await getModuleCollections(fyId, moduleId);
    
    let currentFY;
    let prevCollections = [];
    if (fyId === 'all') {
      currentFY = {
        _id: 'all',
        year: 'All Years',
        label: 'All Years'
      };
    } else {
      const startYear = parseInt(fyId);
      const endYear = startYear + 1;
      currentFY = {
        _id: fyId,
        startYear,
        endYear,
        year: `${startYear}-${String(endYear).substring(2)}`,
        label: `${startYear}-${String(endYear).substring(2)}`
      };
      const prevStartYear = startYear - 1;
      prevCollections = await getModuleCollections(prevStartYear.toString(), moduleId);
    }
    if (!moduleId || moduleId === 'all') {
      const modules = await Module.find({ $or: [{ isActive: true }, { code: { $in: ['pro', 'ofc', 'glb', 'office', 'global'] } }] }).sort({ sortOrder: 1, name: 1 });
      const rankingsList = modules.map(mod => {
        const curr = collections.filter(c => c.module && getModuleId(c.module) === mod._id.toString()).reduce((s, c) => s + (c.totalAmount || 0), 0);
        const prev = prevCollections.filter(c => c.module && getModuleId(c.module) === mod._id.toString()).reduce((s, c) => s + (c.totalAmount || 0), 0);
        const growth = prev > 0 ? ((curr - prev) / prev * 100) : (curr > 0 ? 100 : 0);
        return {
          proId: mod._id.toString(),
          name: mod.name,
          total: curr,
          prevTotal: prev,
          growth: Math.round(growth * 100) / 100,
          status: 'active',
          isCategory: true
        };
      });

      const categoryRankings = rankingsList
        .sort((a, b) => b.total - a.total)
        .map((r, idx) => ({ ...r, rank: idx + 1 }));

      console.log('categoryRankings:', categoryRankings);

      return res.json({ success: true, data: { rankings: categoryRankings, zeroPros: [], totalPros: modules.length } });
    }

    const proMap = {};
    for (const c of collections) {
      if (!c.pro) continue;
      const pid = c.pro._id ? c.pro._id.toString() : c.pro.toString();
      if (!proMap[pid]) proMap[pid] = { proId: pid, name: c.proName || (c.pro.name || pid), total: 0 };
      proMap[pid].total += (c.totalAmount || 0);
    }
    const prevMap = {};
    for (const c of prevCollections) {
      if (!c.pro) continue;
      const pid = c.pro._id ? c.pro._id.toString() : c.pro.toString();
      if (!prevMap[pid]) prevMap[pid] = 0;
      prevMap[pid] += (c.totalAmount || 0);
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
        return { ...p, prevTotal: prev, growth: Math.round(growth * 100) / 100, status: proStatusMap[p.proId] || 'active', isCategory: false };
      })
      .sort((a, b) => b.total - a.total)
      .map((p, i) => ({ ...p, rank: i + 1 }));

    const contributingIds = new Set(Object.keys(proMap));
    const zeroPros = pros.filter(p => !contributingIds.has(p._id.toString()))
      .map(p => ({ proId: p._id.toString(), name: p.name, total: 0, rank: null, status: p.status, growth: 0, isCategory: false }));

    res.json({ success: true, data: { rankings, zeroPros, totalPros: pros.length } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/analytics/pro/:proId?financialYear=id&module=id&month=MonthName
router.get('/pro/:proId', protect, async (req, res) => {
  try {
    const { financialYear, module: moduleId, month: filterMonth } = req.query;
    let fyId = financialYear || 'all';

    const colFilter = { pro: req.params.proId };
    if (fyId !== 'all') {
      const { startDate, endDate } = getFYDateRange(fyId);
      colFilter.date = { $gte: startDate, $lte: endDate };
    }
    if (moduleId) colFilter.module = moduleId;
    if (filterMonth && MONTHS.includes(filterMonth)) colFilter.month = filterMonth;

    const [pro, collections] = await Promise.all([
      Pro.findById(req.params.proId).populate('module', 'name code color'),
      Collection.find(colFilter).sort({ date: 1 })
    ]);
    if (!pro) return res.status(404).json({ success: false, message: 'PRO not found' });

    let currentFY;
    let prevCollections = [];
    let allPrevCollections = [];
    let growth = 0;
    let prevTotal = 0;

    if (fyId === 'all') {
      currentFY = {
        _id: 'all',
        year: 'All Years',
        label: 'All Years'
      };
    } else {
      const startYear = parseInt(fyId);
      const endYear = startYear + 1;
      currentFY = {
        _id: fyId,
        startYear,
        endYear,
        year: `${startYear}-${String(endYear).substring(2)}`,
        label: `${startYear}-${String(endYear).substring(2)}`
      };

      const prevStartYear = startYear - 1;
      const prevFYDateRange = getFYDateRange(prevStartYear.toString());
      const prevFilter = { date: { $gte: prevFYDateRange.startDate, $lte: prevFYDateRange.endDate }, pro: req.params.proId };
      if (moduleId) prevFilter.module = moduleId;
      if (filterMonth && MONTHS.includes(filterMonth)) prevFilter.month = filterMonth;
      prevCollections = await Collection.find(prevFilter).sort({ date: 1 });

      prevTotal = prevCollections.reduce((s, c) => s + (c.totalAmount || 0), 0);
      const totalCol = collections.reduce((s, c) => s + (c.totalAmount || 0), 0);
      growth = prevTotal > 0 ? ((totalCol - prevTotal) / prevTotal * 100) : (totalCol > 0 ? 100 : 0);

      if (filterMonth) {
        const prevAllFilter = { date: { $gte: prevFYDateRange.startDate, $lte: prevFYDateRange.endDate }, pro: req.params.proId };
        if (moduleId) prevAllFilter.module = moduleId;
        allPrevCollections = await Collection.find(prevAllFilter).sort({ date: 1 });
      } else {
        allPrevCollections = prevCollections;
      }
    }

    const total = collections.reduce((s, c) => s + (c.totalAmount || 0), 0);
    const allColFilter = { pro: req.params.proId };
    if (fyId !== 'all') {
      const { startDate, endDate } = getFYDateRange(fyId);
      allColFilter.date = { $gte: startDate, $lte: endDate };
    }
    if (moduleId) allColFilter.module = moduleId;

    let allCollections = collections;
    let allPrevCollectionsFinal = allPrevCollections;

    if (filterMonth) {
      allCollections = await Collection.find(allColFilter).sort({ date: 1 });
      if (fyId !== 'all') {
        const prevStartYear = currentFY.startYear - 1;
        const prevFYDateRange = getFYDateRange(prevStartYear.toString());
        const prevAllFilter = { date: { $gte: prevFYDateRange.startDate, $lte: prevFYDateRange.endDate }, pro: req.params.proId };
        if (moduleId) prevAllFilter.module = moduleId;
        allPrevCollectionsFinal = await Collection.find(prevAllFilter).sort({ date: 1 });
      }
    }

    const monthlyBreakdown = MONTHS.map((month, idx) => {
      const currCols = allCollections.filter(c => c.month === month);
      const prevCols = allPrevCollections.filter(c => c.month === month);
      const currentSum = currCols.reduce((sum, c) => sum + (c.totalAmount || 0), 0);
      const previousSum = prevCols.reduce((sum, c) => sum + (c.totalAmount || 0), 0);
      return {
        month,
        index: idx,
        current: currentSum,
        previous: previousSum,
        amount: currentSum
      };
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

    const startYear1 = parseInt(year1);
    const endYear1 = startYear1 + 1;
    const fy1 = {
      _id: year1,
      year: `${startYear1}-${String(endYear1).substring(2)}`,
      label: `FY ${startYear1}-${String(endYear1).substring(2)}`
    };

    const startYear2 = parseInt(year2);
    const endYear2 = startYear2 + 1;
    const fy2 = {
      _id: year2,
      year: `${startYear2}-${String(endYear2).substring(2)}`,
      label: `FY ${startYear2}-${String(endYear2).substring(2)}`
    };

    const [cols1, cols2] = await Promise.all([
      getModuleCollections(year1, moduleId),
      getModuleCollections(year2, moduleId)
    ]);

    const proIds = [...new Set([...cols1, ...cols2].filter(c => c.pro).map(c => getProId(c.pro)))];
    const pros = await Pro.find({ _id: { $in: proIds } });
    const proNameMap = {};
    pros.forEach(p => proNameMap[p._id.toString()] = p.name);

    const monthly1 = MONTHS.map(m => ({ month: m, total: cols1.filter(c => c.month === m).reduce((s, c) => s + (c.totalAmount || 0), 0) }));
    const monthly2 = MONTHS.map(m => ({ month: m, total: cols2.filter(c => c.month === m).reduce((s, c) => s + (c.totalAmount || 0), 0) }));

    const proMonthlyComparison = proIds.map(pid => {
      const name = proNameMap[pid] || pid;
      const yearData1 = MONTHS.map(m => ({ month: m, total: cols1.filter(c => c.pro && getProId(c.pro) === pid && c.month === m).reduce((s, c) => s + (c.totalAmount || 0), 0) }));
      const yearData2 = MONTHS.map(m => ({ month: m, total: cols2.filter(c => c.pro && getProId(c.pro) === pid && c.month === m).reduce((s, c) => s + (c.totalAmount || 0), 0) }));
      const t1 = yearData1.reduce((s, m) => s + m.total, 0);
      const t2 = yearData2.reduce((s, m) => s + m.total, 0);
      const growth = t1 > 0 ? ((t2 - t1) / t1 * 100) : (t2 > 0 ? 100 : 0);
      return { proId: pid, name, year1Monthly: yearData1, year2Monthly: yearData2, total1: t1, total2: t2, growth: Math.round(growth * 100) / 100 };
    });

    const total1 = cols1.reduce((s, c) => s + (c.totalAmount || 0), 0);
    const total2 = cols2.reduce((s, c) => s + (c.totalAmount || 0), 0);
    const diff = total2 - total1;
    const growthPct = total1 > 0 ? (diff / total1 * 100) : 0;

    let categoryComparison = null;
    if (!moduleId || moduleId === 'all') {
      const modules = await Module.find({ $or: [{ isActive: true }, { code: { $in: ['pro', 'ofc', 'glb', 'office', 'global'] } }] }).sort({ sortOrder: 1, name: 1 });
      const categoryComparisonList = modules.map(mod => {
        const val1 = cols1.filter(c => c.module && getModuleId(c.module) === mod._id.toString()).reduce((s, c) => s + (c.totalAmount || 0), 0);
        const val2 = cols2.filter(c => c.module && getModuleId(c.module) === mod._id.toString()).reduce((s, c) => s + (c.totalAmount || 0), 0);
        const diff = val2 - val1;
        const growthPct = val1 > 0 ? ((val2 - val1) / val1 * 100) : (val2 > 0 ? 100 : 0);
        const contributionPct = total2 > 0 ? (val2 / total2 * 100) : 0;
        return {
          name: mod.name,
          code: mod.code,
          color: mod.color || '#d4af37',
          year1Val: val1,
          year2Val: val2,
          diff,
          growthPct: Math.round(growthPct * 100) / 100,
          contributionPct: Math.round(contributionPct * 100) / 100
        };
      });

      const sortedCats = [...categoryComparisonList].sort((a, b) => b.year2Val - a.year2Val);
      const highest = sortedCats[0]?.year2Val > 0 ? sortedCats[0] : null;
      const lowest = sortedCats.filter(c => c.year2Val > 0).pop() || null;

      categoryComparison = {
        categories: categoryComparisonList,
        highest,
        lowest
      };
    }

    res.json({ success: true, data: {
      year1: { label: fy1?.label, total: total1, monthly: monthly1 },
      year2: { label: fy2?.label, total: total2, monthly: monthly2 },
      diff, growthPct: Math.round(growthPct * 100) / 100,
      proMonthlyComparison,
      categoryComparison
    }});
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/analytics/insights?financialYear=id&module=id
router.get('/insights', protect, async (req, res) => {
  try {
    const { financialYear, module: moduleId } = req.query;
    let fyId = financialYear || 'all';

    const proFilter = {};
    if (moduleId) proFilter.module = moduleId;
    const [collections, pros] = await Promise.all([
      getModuleCollections(fyId, moduleId), Pro.find(proFilter)
    ]);

    let currentFY;
    if (fyId === 'all') {
      currentFY = {
        _id: 'all',
        label: 'All Years',
        year: 'All Years'
      };
    } else {
      const startYear = parseInt(fyId);
      const endYear = startYear + 1;
      currentFY = {
        _id: fyId,
        label: `${startYear}-${String(endYear).substring(2)}`,
        year: `${startYear}-${String(endYear).substring(2)}`,
        startYear,
        endYear
      };
    }

    const total = collections.reduce((s, c) => s + (c.totalAmount || 0), 0);
    const proMap = {};
    for (const c of collections) {
      if (!c.pro) continue;
      const pid = c.pro._id ? c.pro._id.toString() : c.pro.toString();
      if (!proMap[pid]) proMap[pid] = { name: c.proName, total: 0 };
      proMap[pid].total += (c.totalAmount || 0);
    }
    const sorted = Object.values(proMap).sort((a, b) => b.total - a.total);
    const topPerformer = sorted[0];
    const activePros = pros.filter(p => p.status === 'active');
    const contributingIds = new Set(Object.keys(proMap));
    const zeroPros = activePros.filter(p => !contributingIds.has(p._id.toString()));

    const monthlyTotals = MONTHS.map(m => collections.filter(c => c.month === m).reduce((s, c) => s + (c.totalAmount || 0), 0));
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

// GET /api/analytics/monthly-comparison
router.get('/monthly-comparison', protect, async (req, res) => {
  try {
    const { financialYear, module: moduleId, month: selectedMonth } = req.query;
    
    let fyId = financialYear || 'all';

    let currentFY;
    if (fyId === 'all') {
      currentFY = {
        _id: 'all',
        label: 'All Years',
        year: 'All Years'
      };
    } else {
      const startYear = parseInt(fyId);
      const endYear = startYear + 1;
      currentFY = {
        _id: fyId,
        label: `${startYear}-${String(endYear).substring(2)}`,
        year: `${startYear}-${String(endYear).substring(2)}`,
        startYear,
        endYear
      };
    }
    
    const collections = await getModuleCollections(fyId, moduleId);
    
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
      if (!c.pro) return;
      const pid = c.pro._id ? c.pro._id.toString() : c.pro.toString();
      if (proMap[pid]) {
        proMap[pid].monthlyAmounts[c.month] = (c.totalAmount || 0);
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
      if (currentFY && currentFY._id !== 'all') {
        const prevStartYear = currentFY.startYear - 1;
        const prevFYDateRange = getFYDateRange(prevStartYear.toString());
        const prevQuery = { date: { $gte: prevFYDateRange.startDate, $lte: prevFYDateRange.endDate }, month: 'March' };
        if (moduleId) prevQuery.module = moduleId;
        const prevCols = await Collection.find(prevQuery);
        prevMonthTotal = prevCols.reduce((s, c) => s + (c.totalAmount || 0), 0);
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
