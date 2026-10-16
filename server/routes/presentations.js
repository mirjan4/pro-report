const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { protect, adminOnly } = require('../middleware/auth');
const Presentation = require('../models/Presentation');
const mongoose = require('mongoose');


// Database models for aggregation
const Collection = require('../models/Collection');
const Pro = require('../models/Pro');
const Module = require('../models/Module');
const Sponsor = require('../models/Sponsor');
const Distribution = require('../models/Distribution');
const FinancialYear = require('../models/FinancialYear');

const MONTHS = ['April','May','June','July','August','September','October','November','December','January','February','March'];
const MONTHS_CALENDAR_MAP = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Dynamic Duration Boundaries Resolver
function resolveDurationBoundaries(periodType, customRange, fySelection, now = new Date()) {
  let startDate, endDate, prevStartDate, prevEndDate, periodLabel, prevPeriodLabel, monthsList = [];
  const currentYear = now.getUTCFullYear();
  const currentMonthIdx = now.getUTCMonth(); // 0 to 11

  const pType = periodType || 'last6Months';

  if (pType === 'thisMonth') {
    startDate = new Date(Date.UTC(currentYear, currentMonthIdx, 1, 0, 0, 0));
    endDate = new Date(Date.UTC(currentYear, currentMonthIdx + 1, 0, 23, 59, 59, 999));
    
    prevStartDate = new Date(Date.UTC(currentYear, currentMonthIdx - 1, 1, 0, 0, 0));
    prevEndDate = new Date(Date.UTC(currentYear, currentMonthIdx, 0, 23, 59, 59, 999));
    
    periodLabel = `${MONTHS_CALENDAR_MAP[currentMonthIdx]} ${currentYear}`;
    prevPeriodLabel = `${MONTHS_CALENDAR_MAP[prevStartDate.getUTCMonth()]} ${prevStartDate.getUTCFullYear()}`;
    monthsList = [{
      month: MONTHS_CALENDAR_MAP[currentMonthIdx],
      year: currentYear,
      label: `${MONTHS_CALENDAR_MAP[currentMonthIdx].slice(0, 3)} '${String(currentYear).slice(2)}`,
      key: `${currentYear}-${String(currentMonthIdx + 1).padStart(2, '0')}`
    }];
  } 
  else if (pType === 'prevMonth') {
    startDate = new Date(Date.UTC(currentYear, currentMonthIdx - 1, 1, 0, 0, 0));
    endDate = new Date(Date.UTC(currentYear, currentMonthIdx, 0, 23, 59, 59, 999));
    
    prevStartDate = new Date(Date.UTC(currentYear, currentMonthIdx - 2, 1, 0, 0, 0));
    prevEndDate = new Date(Date.UTC(currentYear, currentMonthIdx - 1, 0, 23, 59, 59, 999));
    
    periodLabel = `${MONTHS_CALENDAR_MAP[startDate.getUTCMonth()]} ${startDate.getUTCFullYear()}`;
    prevPeriodLabel = `${MONTHS_CALENDAR_MAP[prevStartDate.getUTCMonth()]} ${prevStartDate.getUTCFullYear()}`;
    monthsList = [{
      month: MONTHS_CALENDAR_MAP[startDate.getUTCMonth()],
      year: startDate.getUTCFullYear(),
      label: `${MONTHS_CALENDAR_MAP[startDate.getUTCMonth()].slice(0, 3)} '${String(startDate.getUTCFullYear()).slice(2)}`,
      key: `${startDate.getUTCFullYear()}-${String(startDate.getUTCMonth() + 1).padStart(2, '0')}`
    }];
  } 
  else if (pType === 'last3Months' || pType === 'last6Months' || pType === 'last12Months') {
    const numMonths = pType === 'last3Months' ? 3 : (pType === 'last6Months' ? 6 : 12);
    startDate = new Date(Date.UTC(currentYear, currentMonthIdx - numMonths + 1, 1, 0, 0, 0));
    endDate = new Date(Date.UTC(currentYear, currentMonthIdx + 1, 0, 23, 59, 59, 999));
    
    prevStartDate = new Date(Date.UTC(currentYear, currentMonthIdx - (numMonths * 2) + 1, 1, 0, 0, 0));
    prevEndDate = new Date(Date.UTC(currentYear, currentMonthIdx - numMonths + 1, 0, 23, 59, 59, 999));
    
    for (let i = 0; i < numMonths; i++) {
      const d = new Date(Date.UTC(currentYear, currentMonthIdx - numMonths + 1 + i, 1));
      monthsList.push({
        month: MONTHS_CALENDAR_MAP[d.getUTCMonth()],
        year: d.getUTCFullYear(),
        label: `${MONTHS_CALENDAR_MAP[d.getUTCMonth()].slice(0, 3)} '${String(d.getUTCFullYear()).slice(2)}`,
        key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
      });
    }
    periodLabel = `Last ${numMonths} Months (${monthsList[0].label} - ${monthsList[monthsList.length - 1].label})`;
    prevPeriodLabel = `Prior ${numMonths} Months`;
  } 
  else if (pType === 'financialYear') {
    let startYear = currentMonthIdx >= 3 ? currentYear : currentYear - 1;
    if (fySelection && fySelection !== 'all') {
      const parsed = parseInt(fySelection);
      if (!isNaN(parsed) && parsed > 2000) startYear = parsed;
    }
    const endYear = startYear + 1;
    startDate = new Date(Date.UTC(startYear, 3, 1, 0, 0, 0)); // April 1
    endDate = new Date(Date.UTC(endYear, 2, 31, 23, 59, 59, 999)); // March 31
    
    prevStartDate = new Date(Date.UTC(startYear - 1, 3, 1, 0, 0, 0));
    prevEndDate = new Date(Date.UTC(startYear, 2, 31, 23, 59, 59, 999));
    
    periodLabel = `FY ${startYear}-${String(endYear).slice(2)}`;
    prevPeriodLabel = `FY ${startYear - 1}-${String(startYear).slice(2)}`;
    
    for (let i = 0; i < 12; i++) {
      const calMonth = (3 + i) % 12;
      const y = (3 + i) < 12 ? startYear : endYear;
      monthsList.push({
        month: MONTHS_CALENDAR_MAP[calMonth],
        year: y,
        label: `${MONTHS_CALENDAR_MAP[calMonth].slice(0, 3)} '${String(y).slice(2)}`,
        key: `${y}-${String(calMonth + 1).padStart(2, '0')}`
      });
    }
  } 
  else if (pType === 'custom') {
    startDate = customRange?.startDate ? new Date(customRange.startDate) : new Date(Date.UTC(currentYear, currentMonthIdx - 5, 1));
    endDate = customRange?.endDate ? new Date(customRange.endDate + 'T23:59:59.999Z') : new Date(Date.UTC(currentYear, currentMonthIdx + 1, 0, 23, 59, 59, 999));
    
    const diffMs = Math.max(86400000, endDate.getTime() - startDate.getTime());
    prevEndDate = new Date(startDate.getTime() - 1);
    prevStartDate = new Date(prevEndDate.getTime() - diffMs);
    
    const fmt = (d) => `${d.getUTCDate()} ${MONTHS_CALENDAR_MAP[d.getUTCMonth()].slice(0, 3)} ${d.getUTCFullYear()}`;
    periodLabel = `${fmt(startDate)} – ${fmt(endDate)}`;
    prevPeriodLabel = `${fmt(prevStartDate)} – ${fmt(prevEndDate)}`;
    
    let cur = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
    const endMonth = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1));
    while (cur <= endMonth) {
      monthsList.push({
        month: MONTHS_CALENDAR_MAP[cur.getUTCMonth()],
        year: cur.getUTCFullYear(),
        label: `${MONTHS_CALENDAR_MAP[cur.getUTCMonth()].slice(0, 3)} '${String(cur.getUTCFullYear()).slice(2)}`,
        key: `${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, '0')}`
      });
      cur.setUTCMonth(cur.getUTCMonth() + 1);
    }
  } else {
    // Fallback default: last 6 months
    return resolveDurationBoundaries('last6Months', null, null, now);
  }

  return {
    periodType: pType,
    startDate,
    endDate,
    prevStartDate,
    prevEndDate,
    periodLabel,
    prevPeriodLabel,
    monthsList,
    numMonths: Math.max(1, monthsList.length)
  };
}

// Unified compiler for Presentation & Analytics Dashboard data
async function compilePresentationData(query = {}) {
  // 1. Resolve Financial Year parameter if provided
  let fyYearString = 'all';
  if (query.financialYear) {
    if (query.financialYear.year) {
      fyYearString = query.financialYear.year;
    } else if (typeof query.financialYear === 'string' && query.financialYear.length === 4) {
      fyYearString = query.financialYear;
    } else if (mongoose.Types.ObjectId.isValid(query.financialYear)) {
      const fyDoc = await FinancialYear.findById(query.financialYear).lean();
      if (fyDoc) fyYearString = fyDoc.year;
    }
  }

  // 2. Resolve Module/Category
  let targetModuleId = null;
  if (query.module && query.module !== 'all') {
    if (query.module._id) targetModuleId = query.module._id;
    else if (mongoose.Types.ObjectId.isValid(query.module)) targetModuleId = query.module;
  }
  if (!targetModuleId && query.category && query.category !== 'all') {
    if (query.category._id) targetModuleId = query.category._id;
    else if (mongoose.Types.ObjectId.isValid(query.category)) targetModuleId = query.category;
  }

  // 3. Resolve Duration Boundaries
  const duration = resolveDurationBoundaries(query.periodType, query.customRange, fyYearString);

  // 4. Build MongoDB Query Filters
  const currentFilter = {
    date: { $gte: duration.startDate, $lte: duration.endDate }
  };
  const prevFilter = {
    date: { $gte: duration.prevStartDate, $lte: duration.prevEndDate }
  };

  if (targetModuleId) {
    currentFilter.module = targetModuleId;
    prevFilter.module = targetModuleId;
  }

  if (query.pro && query.pro !== 'all') {
    const proIdObj = mongoose.Types.ObjectId.isValid(query.pro) ? new mongoose.Types.ObjectId(query.pro) : query.pro;
    currentFilter.pro = proIdObj;
    prevFilter.pro = proIdObj;
  }

  // 5. Fetch Collections
  const [currentCollectionsRaw, prevCollectionsRaw, prosRaw, modulesRaw] = await Promise.all([
    Collection.find(currentFilter).populate('pro').populate('module').lean(),
    Collection.find(prevFilter).populate('pro').populate('module').lean(),
    Pro.find({}).populate('module').lean(),
    Module.find({}).sort({ sortOrder: 1, name: 1 }).lean()
  ]);

  // Apply collectionFilter (code e.g. 'pro', 'ofc', 'glb') if specified
  const applyCodeFilter = (list) => {
    if (!query.collectionFilter || query.collectionFilter === 'all') return list;
    return list.filter(c => (c.module?.code || '').toLowerCase() === query.collectionFilter.toLowerCase());
  };

  const currentCols = applyCodeFilter(currentCollectionsRaw);
  const prevCols = applyCodeFilter(prevCollectionsRaw);

  // Filter by Source / Additional Head if specified
  let filteredCols = currentCols;
  let filteredPrevCols = prevCols;
  if (query.source && query.source !== 'all') {
    const targetSource = query.source.toLowerCase();
    filteredCols = currentCols.filter(c => {
      if (targetSource === 'takaful' && (c.amount || 0) > 0) return true;
      return (c.additionalCollections || []).some(item => (item.head || '').toLowerCase() === targetSource);
    });
    filteredPrevCols = prevCols.filter(c => {
      if (targetSource === 'takaful' && (c.amount || 0) > 0) return true;
      return (c.additionalCollections || []).some(item => (item.head || '').toLowerCase() === targetSource);
    });
  }

  // 6. Aggregate Totals
  const totalCollection = filteredCols.reduce((sum, c) => sum + (c.totalAmount || 0), 0);
  const takafulTotal = filteredCols.reduce((sum, c) => sum + (c.amount || 0), 0);
  const additionalTotal = filteredCols.reduce((sum, c) => sum + (c.additionalAmount || 0), 0);
  const prevTotal = filteredPrevCols.reduce((sum, c) => sum + (c.totalAmount || 0), 0);

  const growthPct = prevTotal > 0 ? Number((((totalCollection - prevTotal) / prevTotal) * 100).toFixed(1)) : null;
  const growthText = prevTotal > 0 
    ? `${growthPct >= 0 ? '+' : ''}${growthPct}%`
    : (totalCollection > 0 ? 'New' : 'N/A');

  const avgMonthlyCollection = Math.round(totalCollection / duration.numMonths);

  // 7. Initialize normalized PRO map for EVERY PRO in database
  const proMap = {};
  prosRaw.forEach(p => {
    const pid = p._id.toString();
    const monthlyMap = {};
    duration.monthsList.forEach(m => {
      monthlyMap[m.key] = {
        month: m.label,
        fullMonth: m.month,
        year: m.year,
        key: m.key,
        amount: 0,
        takaful: 0,
        additional: 0
      };
    });

    proMap[pid] = {
      proId: pid,
      name: p.name,
      designation: p.designation || 'PRO Officer',
      area: p.area || '—',
      mobile: p.mobile || '',
      email: p.email || '',
      category: p.module?.name || 'Takaful',
      status: p.status || 'active',
      totalCollection: 0,
      takafulAmount: 0,
      additionalAmount: 0,
      prevTotal: 0,
      monthlyMap,
      headAmounts: {}
    };
  });

  // Populate Current Collections into PRO Map
  filteredCols.forEach(c => {
    if (!c.pro) return;
    const pid = c.pro._id ? c.pro._id.toString() : c.pro.toString();
    if (!proMap[pid]) {
      // If PRO was not in active list (e.g. historical PRO)
      const monthlyMap = {};
      duration.monthsList.forEach(m => {
        monthlyMap[m.key] = {
          month: m.label,
          fullMonth: m.month,
          year: m.year,
          key: m.key,
          amount: 0,
          takaful: 0,
          additional: 0
        };
      });
      proMap[pid] = {
        proId: pid,
        name: c.proName || c.pro?.name || 'PRO Officer',
        designation: c.pro?.designation || 'PRO Officer',
        area: c.pro?.area || '—',
        category: c.module?.name || 'Takaful',
        status: c.pro?.status || 'active',
        totalCollection: 0,
        takafulAmount: 0,
        additionalAmount: 0,
        prevTotal: 0,
        monthlyMap,
        headAmounts: {}
      };
    }

    const item = proMap[pid];
    item.totalCollection += (c.totalAmount || 0);
    item.takafulAmount += (c.amount || 0);
    item.additionalAmount += (c.additionalAmount || 0);

    // Accumulate to monthly breakdown
    if (c.date) {
      const d = new Date(c.date);
      const mKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      if (item.monthlyMap[mKey]) {
        item.monthlyMap[mKey].amount += (c.totalAmount || 0);
        item.monthlyMap[mKey].takaful += (c.amount || 0);
        item.monthlyMap[mKey].additional += (c.additionalAmount || 0);
      }
    }

    // Accumulate additional heads
    if (c.additionalCollections && c.additionalCollections.length > 0) {
      c.additionalCollections.forEach(add => {
        const head = add.head || 'Other';
        item.headAmounts[head] = (item.headAmounts[head] || 0) + (add.amount || 0);
      });
    }
  });

  // Populate Previous Period Collections into PRO Map
  filteredPrevCols.forEach(c => {
    if (!c.pro) return;
    const pid = c.pro._id ? c.pro._id.toString() : c.pro.toString();
    if (proMap[pid]) {
      proMap[pid].prevTotal += (c.totalAmount || 0);
    }
  });

  // Calculate stats for each PRO
  const allProsCalculated = Object.values(proMap).map(p => {
    const monthlyData = duration.monthsList.map(m => {
      const entry = p.monthlyMap[m.key] || {};
      const tot = entry.amount || 0;
      return {
        month: m.label,
        label: m.label,
        fullMonth: m.month,
        year: m.year,
        key: m.key,
        amount: tot,
        total: tot,
        takaful: entry.takaful || 0,
        additional: entry.additional || 0
      };
    });
    const avgMonthly = Math.round(p.totalCollection / duration.numMonths);
    
    // Find highest month
    let highestMonth = { month: '—', label: '—', amount: 0 };
    monthlyData.forEach(m => {
      const amt = m.total || m.amount || 0;
      if (amt > highestMonth.amount) {
        highestMonth = { month: m.label, label: m.label, amount: amt };
      }
    });

    const proGrowthPct = p.prevTotal > 0
      ? Number((((p.totalCollection - p.prevTotal) / p.prevTotal) * 100).toFixed(1))
      : null;

    const proGrowthText = p.prevTotal > 0
      ? `${proGrowthPct >= 0 ? '+' : ''}${proGrowthPct}%`
      : (p.totalCollection > 0 ? 'New' : 'N/A');

    const contributionPct = totalCollection > 0
      ? Number(((p.totalCollection / totalCollection) * 100).toFixed(1))
      : 0;

    const headBreakdown = Object.entries(p.headAmounts).map(([head, amount]) => ({ head, amount }));

    return {
      proId: p.proId,
      name: p.name,
      designation: p.designation,
      area: p.area,
      category: p.category,
      status: p.status,
      totalCollection: p.totalCollection,
      takafulAmount: p.takafulAmount,
      additionalAmount: p.additionalAmount,
      avgMonthly,
      highestMonth,
      prevTotal: p.prevTotal,
      growthPct: proGrowthPct,
      growthText: proGrowthText,
      contributionPct,
      monthlyData,
      headBreakdown
    };
  });

  // Sort rankings by totalCollection descending
  const rankings = allProsCalculated
    .sort((a, b) => b.totalCollection - a.totalCollection)
    .map((p, idx) => ({ ...p, rank: idx + 1 }));

  const top10Pros = rankings.slice(0, 10);
  const topPro = rankings[0] || { name: 'None', totalCollection: 0, contributionPct: 0 };

  const activeProsCount = prosRaw.filter(p => p.status === 'active').length;
  const contributingProsCount = rankings.filter(p => p.totalCollection > 0).length;
  const zeroProsCount = Math.max(0, activeProsCount - contributingProsCount);

  // 8. Monthly Collection Trend & Comparison
  const monthlyTrends = duration.monthsList.map((m, idx) => {
    const monthCols = filteredCols.filter(c => {
      if (!c.date) return false;
      const d = new Date(c.date);
      return d.getUTCFullYear() === m.year && d.getUTCMonth() === MONTHS_CALENDAR_MAP.indexOf(m.month);
    });

    const total = monthCols.reduce((sum, c) => sum + (c.totalAmount || 0), 0);
    const takaful = monthCols.reduce((sum, c) => sum + (c.amount || 0), 0);
    const additional = monthCols.reduce((sum, c) => sum + (c.additionalAmount || 0), 0);

    // Prev period equivalent month
    const prevMonthCols = filteredPrevCols.filter(c => {
      if (!c.date) return false;
      const d = new Date(c.date);
      return d.getUTCMonth() === MONTHS_CALENDAR_MAP.indexOf(m.month);
    });
    const prevPeriodAmount = prevMonthCols.reduce((sum, c) => sum + (c.totalAmount || 0), 0);

    return {
      month: m.month,
      year: m.year,
      label: m.label,
      key: m.key,
      total,
      takaful,
      additional,
      prevPeriodAmount,
      momGrowth: null // computed in second pass below
    };
  });

  // Calculate MoM Growth
  monthlyTrends.forEach((item, idx) => {
    if (idx > 0) {
      const prev = monthlyTrends[idx - 1].total;
      if (prev > 0) {
        item.momGrowth = Number((((item.total - prev) / prev) * 100).toFixed(1));
      }
    }
    item.momGrowthPct = item.momGrowth;
    item.momGrowthText = item.momGrowth !== null && item.momGrowth !== undefined
      ? `${item.momGrowth > 0 ? '+' : ''}${item.momGrowth}%`
      : '—';
  });

  // Find peak month
  let highestMonth = { month: '—', label: '—', amount: 0 };
  monthlyTrends.forEach(m => {
    if (m.total > highestMonth.amount) {
      highestMonth = { month: m.month, year: m.year, label: m.label, amount: m.total };
    }
  });

  // 9. Category Share (Module breakdown)
  const categoryBreakdown = modulesRaw.map(mod => {
    const modCols = filteredCols.filter(c => {
      if (!c.module) return false;
      const mid = c.module._id ? c.module._id.toString() : c.module.toString();
      return mid === mod._id.toString();
    });
    const value = modCols.reduce((sum, c) => sum + (c.totalAmount || 0), 0);
    return {
      name: mod.name,
      code: mod.code,
      color: mod.color || '#f5c518',
      value,
      pct: totalCollection > 0 ? Number(((value / totalCollection) * 100).toFixed(1)) : 0
    };
  }).filter(c => c.value > 0);

  // 10. Growth Movers (Gainers & Decliners)
  const validGrowthPros = rankings.filter(p => p.prevTotal > 0 && p.growthPct !== null);
  const topGainers = [...validGrowthPros]
    .filter(p => p.growthPct > 0)
    .sort((a, b) => b.growthPct - a.growthPct)
    .slice(0, 5);

  const topDecliners = [...validGrowthPros]
    .filter(p => p.growthPct < 0)
    .sort((a, b) => a.growthPct - b.growthPct)
    .slice(0, 5);

  // 11. Sponsors & Distributions Summary
  const [sponsorsRaw, distsRaw] = await Promise.all([
    Sponsor.find({ date: { $gte: duration.startDate, $lte: duration.endDate } }).lean(),
    Distribution.find({ date: { $gte: duration.startDate, $lte: duration.endDate } }).lean()
  ]);

  const totalSponsors = sponsorsRaw.reduce((s, c) => s + (c.totalSponsors || 0), 0);
  const premiumSponsors = sponsorsRaw.reduce((s, c) => s + (c.premiumCount || 0), 0);
  const smartSponsors = sponsorsRaw.reduce((s, c) => s + (c.smartCount || 0), 0);
  const standardSponsors = sponsorsRaw.reduce((s, c) => s + (c.standardCount || 0), 0);

  const distributionHeadMap = {};
  distsRaw.forEach(doc => {
    (doc.distributions || []).forEach(d => {
      const h = d.head || 'Other';
      distributionHeadMap[h] = (distributionHeadMap[h] || 0) + (d.amount || 0);
    });
  });
  const distributionSummary = Object.entries(distributionHeadMap)
    .map(([head, amount]) => ({ head, amount }))
    .sort((a, b) => b.amount - a.amount);

  // 12. Dynamic Observations & Executive Insights
  const observations = [];
  if (totalCollection > 0) {
    observations.push(`Total collections for ${duration.periodLabel} reached ₹${totalCollection.toLocaleString('en-IN')}, averaging ₹${avgMonthlyCollection.toLocaleString('en-IN')} per month.`);
    if (highestMonth.amount > 0) {
      observations.push(`${highestMonth.label} was the strongest collection month with ₹${highestMonth.amount.toLocaleString('en-IN')}.`);
    }
    if (topPro && topPro.totalCollection > 0) {
      observations.push(`Top performing PRO ${topPro.name} generated ₹${topPro.totalCollection.toLocaleString('en-IN')}, contributing ${topPro.contributionPct}% of total collections.`);
    }
    if (top10Pros.length > 0) {
      const top10Total = top10Pros.reduce((s, p) => s + p.totalCollection, 0);
      const top10Pct = ((top10Total / totalCollection) * 100).toFixed(1);
      observations.push(`Top 10 PROs accounted for ${top10Pct}% of total collections.`);
    }
    if (growthPct !== null) {
      observations.push(`Overall collection grew by ${growthText} compared with the previous equivalent period.`);
    }
  } else {
    observations.push(`No collection records recorded for the selected duration (${duration.periodLabel}).`);
    observations.push("Ensure monthly reports are uploaded or verify database collection date ranges.");
  }

  return {
    duration,
    summary: {
      totalCollection,
      takafulTotal,
      additionalTotal,
      activePros: activeProsCount,
      contributingPros: contributingProsCount,
      zeroPros: zeroProsCount,
      avgMonthlyCollection,
      highestMonth,
      topPro: {
        id: topPro.proId || '',
        name: topPro.name || 'None',
        amount: topPro.totalCollection || 0,
        pct: topPro.contributionPct || 0,
        area: topPro.area || '—',
        designation: topPro.designation || 'PRO Officer'
      },
      prevTotal,
      growthPct,
      growthText
    },
    monthlyTrends,
    categoryBreakdown,
    proAnalytics: rankings,
    top10Pros,
    rankings,
    growthMovers: {
      topGainers,
      topDecliners
    },
    observations,
    sponsorsSummary: {
      total: totalSponsors,
      premium: premiumSponsors,
      smart: smartSponsors,
      standard: standardSponsors
    },
    distributionSummary
  };
}

// POST /api/presentations/preview-data — Pre-compile preview data
router.post('/preview-data', protect, async (req, res) => {
  try {
    const data = await compilePresentationData(req.body);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/presentations/analytics — Quick fetch endpoint for dashboard
router.get('/analytics', protect, async (req, res) => {
  try {
    const data = await compilePresentationData(req.query);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/presentations — List presentations
router.get('/', protect, async (req, res) => {
  try {
    const list = await Presentation.find({ createdBy: req.user._id })
      .populate('financialYear')
      .populate('module')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/presentations/:id — Get presentation detail
router.get('/:id', protect, async (req, res) => {
  try {
    const presentation = await Presentation.findById(req.params.id)
      .populate('financialYear')
      .populate('module');
    if (!presentation) {
      return res.status(404).json({ success: false, message: 'Presentation not found' });
    }
    res.json({ success: true, data: presentation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/presentations — Create presentation (admin only)
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { title, collectionFilter, periodType, customRange, financialYear, module, slides, accessControl, liveData } = req.body;

    const data = {
      title,
      collectionFilter,
      periodType,
      customRange,
      financialYear: financialYear && financialYear !== 'all' ? financialYear : undefined,
      module: module && module !== 'all' ? module : undefined,
      slides,
      accessControl: {
        isPublic: accessControl?.isPublic ?? true,
        isPasswordProtected: accessControl?.isPasswordProtected ?? false,
        expiresAt: accessControl?.expiresAt || undefined
      },
      liveData: liveData ?? true,
      createdBy: req.user._id
    };

    // Hash password if enabled
    if (accessControl?.isPasswordProtected && accessControl?.password) {
      const salt = await bcrypt.genSalt(10);
      data.accessControl.password = await bcrypt.hash(accessControl.password, salt);
    }

    const tempPresentation = new Presentation(data);

    // If static snapshot chosen, pre-compile reporting data and freeze it
    if (!data.liveData) {
      tempPresentation.snapshotData = await compilePresentationData(tempPresentation);
    }

    const saved = await tempPresentation.save();
    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PUT /api/presentations/:id — Update presentation config (admin only)
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const presentation = await Presentation.findById(req.params.id);
    if (!presentation) {
      return res.status(404).json({ success: false, message: 'Presentation not found' });
    }

    const { title, collectionFilter, periodType, customRange, financialYear, module, slides, accessControl, liveData } = req.body;

    presentation.title = title || presentation.title;
    presentation.collectionFilter = collectionFilter || presentation.collectionFilter;
    presentation.periodType = periodType || presentation.periodType;
    presentation.customRange = customRange || presentation.customRange;
    presentation.financialYear = financialYear && financialYear !== 'all' ? financialYear : undefined;
    presentation.module = module && module !== 'all' ? module : undefined;
    presentation.slides = slides || presentation.slides;
    presentation.liveData = liveData ?? presentation.liveData;

    if (accessControl) {
      presentation.accessControl.isPublic = accessControl.isPublic ?? presentation.accessControl.isPublic;
      presentation.accessControl.isPasswordProtected = accessControl.isPasswordProtected ?? presentation.accessControl.isPasswordProtected;
      presentation.accessControl.expiresAt = accessControl.expiresAt || presentation.accessControl.expiresAt;

      if (accessControl.isPasswordProtected && accessControl.password) {
        const salt = await bcrypt.genSalt(10);
        presentation.accessControl.password = await bcrypt.hash(accessControl.password, salt);
      }
    }

    // Refresh static snapshot if toggled or kept static
    if (!presentation.liveData) {
      presentation.snapshotData = await compilePresentationData(presentation);
    } else {
      presentation.snapshotData = undefined;
    }

    const updated = await presentation.save();
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// DELETE /api/presentations/:id — Delete presentation (admin only)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const presentation = await Presentation.findByIdAndDelete(req.params.id);
    if (!presentation) {
      return res.status(404).json({ success: false, message: 'Presentation not found' });
    }
    res.json({ success: true, message: 'Presentation deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/presentations/public/:id — Public shared view access point
router.get('/public/:id', async (req, res) => {
  try {
    const presentation = await Presentation.findById(req.params.id)
      .populate('financialYear')
      .populate('module');
    if (!presentation) {
      return res.status(404).json({ success: false, message: 'Presentation not found' });
    }

    // Verify expiration
    if (presentation.accessControl?.expiresAt) {
      const expiry = new Date(presentation.accessControl.expiresAt);
      if (expiry < new Date()) {
        return res.status(400).json({ success: false, message: 'This presentation link has expired.' });
      }
    }

    // Verify password protection
    if (presentation.accessControl?.isPasswordProtected) {
      const clientPassword = req.headers['x-presentation-password'] || req.query.password;
      if (!clientPassword) {
        return res.json({
          success: true,
          isPasswordRequired: true,
          title: presentation.title
        });
      }

      const match = await bcrypt.compare(clientPassword, presentation.accessControl.password);
      if (!match) {
        return res.status(401).json({ success: false, message: 'Invalid password' });
      }
    }

    // Compile slide data (live vs snapshot)
    let presentationData;
    if (presentation.liveData) {
      presentationData = await compilePresentationData(presentation);
    } else {
      presentationData = presentation.snapshotData;
    }

    res.json({
      success: true,
      isPasswordRequired: false,
      presentation,
      data: presentationData
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/presentations/public/:id/verify — Public password verification challenge
router.post('/public/:id/verify', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required' });
    }

    const presentation = await Presentation.findById(req.params.id);
    if (!presentation) {
      return res.status(404).json({ success: false, message: 'Presentation not found' });
    }

    if (!presentation.accessControl?.isPasswordProtected) {
      return res.json({ success: true, message: 'No password is set on this presentation' });
    }

    const match = await bcrypt.compare(password, presentation.accessControl.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Incorrect password' });
    }

    // Return slide details
    let presentationData;
    if (presentation.liveData) {
      presentationData = await compilePresentationData(presentation);
    } else {
      presentationData = presentation.snapshotData;
    }

    res.json({
      success: true,
      isPasswordRequired: false,
      presentation,
      data: presentationData
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
