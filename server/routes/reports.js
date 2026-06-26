const express = require('express');
const router = express.Router();
const Collection = require('../models/Collection');
const Pro = require('../models/Pro');
const Module = require('../models/Module');
const { protect } = require('../middleware/auth');

const MONTHS = ['April','May','June','July','August','September','October','November','December','January','February','March'];
const MONTHS_CALENDAR = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function getModuleId(m) {
  if (!m) return '';
  return m._id ? m._id.toString() : m.toString();
}

function getProId(p) {
  if (!p) return '';
  return p._id ? p._id.toString() : p.toString();
}

function formatDatePretty(dateStr) {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const day = String(date.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

router.get('/full-data', protect, async (req, res) => {
  try {
    const { financialYear, month, startDate, endDate, module: moduleId } = req.query;

    let query = {};
    if (financialYear && financialYear !== 'all' && !startDate) {
      const startYear = parseInt(financialYear);
      const endYear = startYear + 1;
      const start = new Date(Date.UTC(startYear, 3, 1, 0, 0, 0)); // April 1
      const end = new Date(Date.UTC(endYear, 2, 31, 23, 59, 59, 999)); // March 31
      query.date = { $gte: start, $lte: end };
    }
    if (moduleId) {
      query.module = moduleId;
    }

    let proQuery = {};
    if (moduleId) {
      proQuery.module = moduleId;
    }

    const [collections, pros] = await Promise.all([
      Collection.find(query)
        .populate('pro')
        .populate('module')
        .sort({ date: 1, proName: 1 }),
      Pro.find(proQuery).sort({ name: 1 })
    ]);

    const collectionsWithDate = collections.map(c => {
      // Safely derive a date: use stored date, or construct from month/year fields
      let d;
      if (c.date) {
        d = new Date(c.date);
      } else if (c.month && c.year) {
        const MONTHS_CAL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        const mIdx = MONTHS_CAL.indexOf(c.month);
        d = mIdx >= 0 ? new Date(Date.UTC(c.year, mIdx, 1)) : new Date();
      } else {
        d = new Date();
      }
      const monthIdx = d.getMonth();
      const startYear = monthIdx >= 3 ? d.getFullYear() : d.getFullYear() - 1;
      const endYear = startYear + 1;
      const financialYearObj = {
        _id: startYear.toString(),
        year: `${startYear}-${String(endYear).substring(2)}`,
        label: `FY ${startYear}-${String(endYear).substring(2)}`,
        startYear,
        endYear
      };
      return {
        ...c.toObject(),
        financialYear: financialYearObj,
        date: d
      };
    });

    let filteredCollections = collectionsWithDate;

    if (month) {
      filteredCollections = filteredCollections.filter(c => c.month === month);
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      filteredCollections = filteredCollections.filter(c => c.date >= start && c.date <= end);
    }

    // Determine current FY or Date range label
    let fyLabel = '';
    let fyYear = '';
    if (startDate && endDate) {
      const startPretty = formatDatePretty(startDate);
      const endPretty = formatDatePretty(endDate);
      fyLabel = `Custom Date Range: ${startPretty} to ${endPretty}`;
      fyYear = `${startPretty}_to_${endPretty}`;
    } else if (financialYear === 'all') {
      fyLabel = 'All Years';
      if (month) {
        fyLabel += ` - ${month}`;
      }
      fyYear = 'All Years';
      if (month) {
        fyYear += `_${month}`;
      }
    } else {
      let targetStartYear = 2025;
      if (financialYear) {
        targetStartYear = parseInt(financialYear);
      } else {
        const today = new Date();
        const y = today.getFullYear();
        const m = today.getMonth();
        targetStartYear = m >= 3 ? y : y - 1;
      }
      const targetEndYear = targetStartYear + 1;
      fyLabel = `${targetStartYear}-${String(targetEndYear).substring(2)}`;
      if (month) {
        fyLabel += ` - ${month}`;
      }
      fyYear = `${targetStartYear}-${String(targetEndYear).substring(2)}`;
      if (month) {
        fyYear += `_${month}`;
      }
    }

    let proSummaries = [];
    if (!moduleId || moduleId === 'all') {
      const modules = await Module.find({ $or: [{ isActive: true }, { code: { $in: ['pro', 'ofc', 'glb', 'office', 'global'] } }] }).sort({ sortOrder: 1, name: 1 });
      proSummaries = modules.map(mod => {
        const modCols = filteredCollections.filter(c => c.module && getModuleId(c.module) === mod._id.toString());
        const total = modCols.reduce((s, c) => s + (c.totalAmount || 0), 0);
        return {
          name: mod.name,
          area: 'All Areas',
          status: 'active',
          total,
          global: mod.code === 'global' || mod.code === 'glb' ? total : 0,
          pro: mod.code === 'pro' ? total : 0,
          office: mod.code === 'office' || mod.code === 'ofc' ? total : 0,
          isCategory: true
        };
      }).sort((a, b) => b.total - a.total).map((p, i) => ({ ...p, rank: p.total > 0 ? i + 1 : '-' }));
    } else {
      proSummaries = pros.map(pro => {
        const proCols = filteredCollections.filter(c => c.pro?._id?.toString() === pro._id.toString());
        const total = proCols.reduce((s, c) => s + (c.totalAmount || 0), 0);
        const global = proCols.filter(c => c.module?.code === 'global' || c.module?.code === 'glb').reduce((s, c) => s + (c.totalAmount || 0), 0);
        const proAmt = proCols.filter(c => c.module?.code === 'pro').reduce((s, c) => s + (c.totalAmount || 0), 0);
        const office = proCols.filter(c => c.module?.code === 'office' || c.module?.code === 'ofc').reduce((s, c) => s + (c.totalAmount || 0), 0);
        return { name: pro.name, area: pro.area, status: pro.status, total, global, pro: proAmt, office, isCategory: false };
      }).sort((a, b) => b.total - a.total).map((p, i) => ({ ...p, rank: p.total > 0 ? i + 1 : '-' }));
    }

    // Generate monthly list dynamically for custom date range, or use MONTHS array
    let monthlyTotals = [];
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      let curr = new Date(start.getFullYear(), start.getMonth(), 1);
      while (curr <= end) {
        const mName = MONTHS_CALENDAR[curr.getMonth()];
        const yearVal = curr.getFullYear();
        const label = `${mName} ${yearVal}`;

        const cols = filteredCollections.filter(c => {
          return c.date.getFullYear() === yearVal && c.date.getMonth() === curr.getMonth();
        });

        monthlyTotals.push({
          month: label,
          total: cols.reduce((s, c) => s + (c.totalAmount || 0), 0),
          global: cols.filter(c => c.module?.code === 'global' || c.module?.code === 'glb').reduce((s, c) => s + (c.totalAmount || 0), 0),
          pro: cols.filter(c => c.module?.code === 'pro').reduce((s, c) => s + (c.totalAmount || 0), 0),
          office: cols.filter(c => c.module?.code === 'office' || c.module?.code === 'ofc').reduce((s, c) => s + (c.totalAmount || 0), 0)
        });

        curr.setMonth(curr.getMonth() + 1);
      }
    } else {
      // Standard MONTHS list
      monthlyTotals = MONTHS.map(mName => {
        const cols = filteredCollections.filter(c => c.month === mName);
        return {
          month: mName,
          total: cols.reduce((s, c) => s + (c.totalAmount || 0), 0),
          global: cols.filter(c => c.module?.code === 'global' || c.module?.code === 'glb').reduce((s, c) => s + (c.totalAmount || 0), 0),
          pro: cols.filter(c => c.module?.code === 'pro').reduce((s, c) => s + (c.totalAmount || 0), 0),
          office: cols.filter(c => c.module?.code === 'office' || c.module?.code === 'ofc').reduce((s, c) => s + (c.totalAmount || 0), 0)
        };
      });
    }

    const grandTotal = {
      total: filteredCollections.reduce((s, c) => s + (c.totalAmount || 0), 0),
      global: filteredCollections.filter(c => c.module?.code === 'global' || c.module?.code === 'glb').reduce((s, c) => s + (c.totalAmount || 0), 0),
      pro: filteredCollections.filter(c => c.module?.code === 'pro').reduce((s, c) => s + (c.totalAmount || 0), 0),
      office: filteredCollections.filter(c => c.module?.code === 'office' || c.module?.code === 'ofc').reduce((s, c) => s + (c.totalAmount || 0), 0)
    };

    res.json({
      success: true,
      data: {
        fyLabel,
        fyYear,
        generatedAt: new Date().toISOString(),
        proSummaries,
        monthlyTotals,
        grandTotal,
        rawCollections: filteredCollections
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/reports/generate — Enhanced multi-period multi-type report compiler
router.get('/generate', protect, async (req, res) => {
  try {
    const { periodType, month, year, financialYear, fromDate, toDate, module: moduleId } = req.query;

    let filter = {};
    let periodTitle = '';
    let periodLabel = '';

    if (periodType === 'month') {
      const yr = Number(year) || new Date().getFullYear();
      filter = { month, year: yr };
      periodTitle = 'TAKAFUL MONTHLY REPORT';
      periodLabel = `${month} ${yr}`;
    } 
    else if (periodType === 'year') {
      const yr = Number(year) || new Date().getFullYear();
      filter = { year: yr };
      periodTitle = 'TAKAFUL YEARLY REPORT';
      periodLabel = `${yr}`;
    }
    else if (periodType === 'fy') {
      const startYear = parseInt(financialYear) || new Date().getFullYear();
      const endYear = startYear + 1;
      const start = new Date(Date.UTC(startYear, 3, 1, 0, 0, 0)); // April 1
      const end = new Date(Date.UTC(endYear, 2, 31, 23, 59, 59, 999)); // March 31
      filter = { date: { $gte: start, $lte: end } };
      periodTitle = 'TAKAFUL FINANCIAL YEAR REPORT';
      periodLabel = `FY ${startYear}-${String(endYear).substring(2)}`;
    }
    else if (periodType === 'custom') {
      const start = new Date(fromDate || new Date());
      const end = new Date(toDate || new Date());
      filter = { date: { $gte: start, $lte: end } };
      
      const formatDateStr = (d) => {
        const day = String(d.getDate()).padStart(2, '0');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${day}-${months[d.getMonth()]}-${d.getFullYear()}`;
      };
      
      periodTitle = 'TAKAFUL CUSTOM PERIOD REPORT';
      periodLabel = `${formatDateStr(start)} to ${formatDateStr(end)}`;
    }

    // Load active modules
    const modules = await Module.find({ $or: [{ isActive: true }, { code: { $in: ['pro', 'ofc', 'glb', 'office', 'global'] } }] }).sort({ sortOrder: 1, name: 1 });

    // Resolve selected collection filter
    let selectedModuleDoc = null;
    let selectedModuleId = null;
    if (moduleId && moduleId !== 'all') {
      selectedModuleDoc = await Module.findById(moduleId).lean();
      selectedModuleId = moduleId;
    }

    const collectionFilterName = selectedModuleDoc ? selectedModuleDoc.name : 'All Collections';
    const collectionFilterCode = selectedModuleDoc ? selectedModuleDoc.code : 'all';

    // 1. Query collections
    const collections = await Collection.find(filter).populate('pro').populate('module').lean();

    // Query distributions
    const Distribution = require('../models/Distribution');
    const distributionsInPeriod = await Distribution.find(filter).lean();

    // 2. Query sponsors (no module filter in Sponsor schema)
    const Sponsor = require('../models/Sponsor');
    const sponsorFilter = { ...filter };
    delete sponsorFilter.module;
    const sponsors = await Sponsor.find(sponsorFilter).populate({ path: 'pro', populate: { path: 'module' } }).lean();

    // Filter by selected module code level if a specific module is chosen
    let filteredCollections = collections;
    let filteredSponsors = sponsors;

    if (selectedModuleId) {
      filteredCollections = collections.filter(c => c.module && getModuleId(c.module) === selectedModuleId.toString());
      filteredSponsors = sponsors.filter(s => s.pro && s.pro.module && getModuleId(s.pro.module) === selectedModuleId.toString());
    }

    // Page 1 Section 1: Sponsors Summary
    const premiumCount = filteredSponsors.reduce((sum, c) => sum + (c.premiumCount || 0), 0);
    const smartCount = filteredSponsors.reduce((sum, c) => sum + (c.smartCount || 0), 0);
    const standardCount = filteredSponsors.reduce((sum, c) => sum + (c.standardCount || 0), 0);
    const totalSponsors = filteredSponsors.reduce((sum, c) => sum + (c.totalSponsors || 0), 0);

    // Page 1 Section 2: Sponsors Added by PRO / Office
    const recSponsorMap = {};
    filteredSponsors.forEach(s => {
      if (!s.pro) return;
      const name = s.proName || s.pro.name;
      if (!recSponsorMap[name]) recSponsorMap[name] = 0;
      recSponsorMap[name] += (s.totalSponsors || 0);
    });
    const sponsorsByRecruiterList = Object.entries(recSponsorMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // Page 1 Section 4: Direct Collections Received Through PROs (grouped by PRO and Head)
    const directGroupMap = {};
    filteredCollections.forEach(c => {
      let items = [];
      if (c.additionalCollections && c.additionalCollections.length > 0) {
        items = c.additionalCollections;
      } else if (c.additionalAmount && c.additionalAmount > 0) {
        items = [{ head: c.additionalHead || 'Other', amount: c.additionalAmount }];
      }

      items.forEach(item => {
        if (item.amount && item.amount > 0) {
          const pName = c.proName || c.pro?.name || '—';
          const head = item.head || 'Other';
          const key = `${pName}::${head}`;
          if (!directGroupMap[key]) {
            directGroupMap[key] = {
              name: pName,
              head: head,
              amount: 0
            };
          }
          directGroupMap[key].amount += item.amount;
        }
      });
    });
    const additionalList = Object.values(directGroupMap)
      .sort((a, b) => b.amount - a.amount);
    const additionalSubtotal = additionalList.reduce((sum, c) => sum + c.amount, 0);

    // Dynamic columns & pivot rows for Detailed Section (Detailed Additional Collections)
    const CollectionHead = require('../models/CollectionHead');
    const activeHeads = await CollectionHead.find({ isActive: true }).lean();
    const headNamesSet = new Set(activeHeads.map(h => h.name));
    
    // Ensure any head dynamically found in collections is represented as a column
    filteredCollections.forEach(c => {
      let items = [];
      if (c.additionalCollections && c.additionalCollections.length > 0) {
        items = c.additionalCollections;
      } else if (c.additionalAmount && c.additionalAmount > 0) {
        items = [{ head: c.additionalHead || 'Other', amount: c.additionalAmount }];
      }

      items.forEach(item => {
        if (item.amount && item.amount > 0 && item.head) {
          headNamesSet.add(item.head);
        }
      });
    });
    const uniqueHeads = Array.from(headNamesSet);

    // Group additional collections by PRO Name and Head for the pivot grid
    const proPivotMap = {};
    filteredCollections.forEach(c => {
      let items = [];
      if (c.additionalCollections && c.additionalCollections.length > 0) {
        items = c.additionalCollections;
      } else if (c.additionalAmount && c.additionalAmount > 0) {
        items = [{ head: c.additionalHead || 'Other', amount: c.additionalAmount }];
      }

      items.forEach(item => {
        if (item.amount && item.amount > 0) {
          const pName = c.proName || c.pro?.name || '—';
          if (!proPivotMap[pName]) {
            proPivotMap[pName] = {
              proName: pName,
              heads: {}
            };
            uniqueHeads.forEach(h => {
              proPivotMap[pName].heads[h] = 0;
            });
          }
          const head = item.head || 'Other';
          if (proPivotMap[pName].heads[head] === undefined) {
            proPivotMap[pName].heads[head] = 0;
          }
          proPivotMap[pName].heads[head] += item.amount;
        }
      });
    });

    const detailedAdditionalRows = Object.values(proPivotMap).map(row => {
      return {
        proName: row.proName,
        ...row.heads
      };
    }).sort((a, b) => {
      const sumA = uniqueHeads.reduce((s, h) => s + (a[h] || 0), 0);
      const sumB = uniqueHeads.reduce((s, h) => s + (b[h] || 0), 0);
      return sumB - sumA;
    });

    // Page 1 Section 3: Takaful Collection Summary (only amount field, excluding additionalAmount)
    const globalTotal = filteredCollections.filter(c => c.module && (c.module.code === 'glb' || c.module.code === 'global')).reduce((sum, c) => sum + (c.amount || 0), 0);
    const proTotal = filteredCollections.filter(c => c.module && c.module.code === 'pro').reduce((sum, c) => sum + (c.amount || 0), 0);
    const officeTotal = filteredCollections.filter(c => c.module && (c.module.code === 'ofc' || c.module.code === 'office')).reduce((sum, c) => sum + (c.amount || 0), 0);
    const totalCollection = globalTotal + proTotal + officeTotal;

    // Calculate distributions
    const distributionTotals = {};
    const DistributionHead = require('../models/DistributionHead');
    const activeDistHeads = await DistributionHead.find({ isActive: true }).lean();
    activeDistHeads.forEach(h => {
      distributionTotals[h.name] = 0;
    });

    // Traverse all distributions found in period
    distributionsInPeriod.forEach(d => {
      if (d.distributions && d.distributions.length > 0) {
        d.distributions.forEach(item => {
          if (item.amount && item.amount > 0) {
            if (distributionTotals[item.head] === undefined) {
              distributionTotals[item.head] = 0;
            }
            distributionTotals[item.head] += item.amount;
          }
        });
      }
    });

    const distributionList = Object.entries(distributionTotals)
      .map(([head, amount]) => ({ head, amount }))
      .sort((a, b) => b.amount - a.amount);

    const totalDistributed = distributionList.reduce((sum, item) => sum + item.amount, 0);
    const remainingTakafulBalance = totalCollection - totalDistributed;

    // Page 2 & Section 5: Detailed Collection Report
    let detailedReportTitle = '';
    let detailedReportColumns = [];
    let detailedReportRows = [];

    if (collectionFilterCode === 'all') {
      detailedReportTitle = 'CATEGORY COLLECTION DETAILS';
      detailedReportColumns = ['Rank', 'Category', 'Collection Amount', 'Contribution %'];
      
      const globalTakaful = filteredCollections.filter(c => c.module && (c.module.code === 'glb' || c.module.code === 'global')).reduce((sum, c) => sum + (c.amount || 0), 0);
      const globalAdd = filteredCollections.filter(c => c.module && (c.module.code === 'glb' || c.module.code === 'global')).reduce((sum, c) => sum + (c.additionalAmount || 0), 0);
      const globalPerf = globalTakaful + globalAdd;

      const proTakaful = filteredCollections.filter(c => c.module && c.module.code === 'pro').reduce((sum, c) => sum + (c.amount || 0), 0);
      const proAdd = filteredCollections.filter(c => c.module && c.module.code === 'pro').reduce((sum, c) => sum + (c.additionalAmount || 0), 0);
      const proPerf = proTakaful + proAdd;

      const officeTakaful = filteredCollections.filter(c => c.module && (c.module.code === 'ofc' || c.module.code === 'office')).reduce((sum, c) => sum + (c.amount || 0), 0);
      const officeAdd = filteredCollections.filter(c => c.module && (c.module.code === 'ofc' || c.module.code === 'office')).reduce((sum, c) => sum + (c.additionalAmount || 0), 0);
      const officePerf = officeTakaful + officeAdd;

      const totalPerf = globalPerf + proPerf + officePerf;

      const categoryList = modules.map(mod => {
        let takaful = 0;
        let additional = 0;
        let total = 0;
        if (mod.code === 'pro') {
          takaful = proTakaful;
          additional = proAdd;
          total = proPerf;
        } else if (mod.code === 'ofc' || mod.code === 'office') {
          takaful = officeTakaful;
          additional = officeAdd;
          total = officePerf;
        } else if (mod.code === 'glb' || mod.code === 'global') {
          takaful = globalTakaful;
          additional = globalAdd;
          total = globalPerf;
        }

        return {
          name: mod.name,
          takafulAmount: takaful,
          additionalAmount: additional,
          amount: total,
          pct: totalPerf > 0 ? parseFloat((total / totalPerf * 100).toFixed(1)) : 0
        };
      }).sort((a, b) => b.amount - a.amount);

      detailedReportRows = categoryList.map((c, idx) => ({
        rank: idx + 1,
        name: c.name,
        takafulAmount: c.takafulAmount,
        additionalAmount: c.additionalAmount,
        amount: c.amount,
        pct: c.pct
      }));
    } else {
      const typeStr = collectionFilterName.toUpperCase();
      detailedReportTitle = `${typeStr} DETAILS`;
      detailedReportColumns = ['Rank', 'PRO Name', 'Collection Amount', 'Contribution %', 'Status'];

      const proMap = {};
      filteredCollections.forEach(c => {
        if (!c.pro) return;
        const pid = getProId(c.pro);
        if (!proMap[pid]) {
          proMap[pid] = { name: c.proName || c.pro.name, area: c.pro.area || '—', takafulTotal: 0, additionalTotal: 0, total: 0, status: c.pro.status || 'active' };
        }
        proMap[pid].takafulTotal += (c.amount || 0);
        proMap[pid].additionalTotal += (c.additionalAmount || 0);
        proMap[pid].total += (c.totalAmount || 0);
      });

      // Include PROs from current module with zero collections
      const prosInModule = await Pro.find({ module: selectedModuleId });
      prosInModule.forEach(p => {
        const pid = p._id.toString();
        if (!proMap[pid]) {
          proMap[pid] = { name: p.name, area: p.area || '—', takafulTotal: 0, additionalTotal: 0, total: 0, status: p.status };
        }
      });

      const proPerfTotal = Object.values(proMap).reduce((s, p) => s + p.total, 0);

      detailedReportRows = Object.values(proMap)
        .sort((a, b) => b.total - a.total)
        .map((p, idx) => ({
          rank: idx + 1,
          name: p.name,
          area: p.area,
          takafulAmount: p.takafulTotal,
          additionalAmount: p.additionalTotal,
          amount: p.total,
          pct: proPerfTotal > 0 ? parseFloat((p.total / proPerfTotal * 100).toFixed(1)) : 0,
          status: p.status
        }));
    }

    const detailedReportTotal = detailedReportRows.reduce((sum, r) => sum + r.amount, 0);

    // Calculate all contributors list for Worksheet 2 (CONTRIBUTOR DETAILS)
    const allProMap = {};
    filteredCollections.forEach(c => {
      if (!c.pro) return;
      const pid = getProId(c.pro);
      if (!allProMap[pid]) {
        allProMap[pid] = {
          name: c.proName || c.pro.name,
          area: c.pro.area || '—',
          takafulTotal: 0,
          additionalTotal: 0,
          total: 0,
          status: c.pro.status || 'active'
        };
      }
      allProMap[pid].takafulTotal += (c.amount || 0);
      allProMap[pid].additionalTotal += (c.additionalAmount || 0);
      allProMap[pid].total += (c.totalAmount || 0);
    });

    let prosToInclude = [];
    if (selectedModuleId) {
      prosToInclude = await Pro.find({ module: selectedModuleId }).lean();
    } else {
      prosToInclude = await Pro.find({}).lean();
    }

    prosToInclude.forEach(p => {
      const pid = p._id.toString();
      if (!allProMap[pid]) {
        allProMap[pid] = {
          name: p.name,
          area: p.area || '—',
          takafulTotal: 0,
          additionalTotal: 0,
          total: 0,
          status: p.status || 'active'
        };
      }
    });

    const allContributorsList = Object.values(allProMap)
      .sort((a, b) => b.total - a.total)
      .map((p, idx) => ({
        rank: idx + 1,
        name: p.name,
        area: p.area,
        takafulAmount: p.takafulTotal,
        additionalAmount: p.additionalTotal,
        amount: p.total,
        status: p.status
      }));

    const totalExpense = filteredCollections.reduce((sum, c) => sum + (c.expense || 0), 0);
    const netBalance = totalCollection - totalExpense;

    res.json({
      success: true,
      allContributors: allContributorsList,
      data: {
        title: periodTitle,
        subtitle: periodLabel,
        periodType,
        collectionFilter: collectionFilterName,
        collectionFilterCode,
        generatedAt: new Date().toISOString(),
        totalExpense,
        netBalance,
        
        // Page 1 Section 1
        sponsorsSummary: {
          premium: premiumCount,
          smart: smartCount,
          standard: standardCount,
          total: totalSponsors
        },
        
        // Page 1 Section 2
        sponsorsByRecruiter: sponsorsByRecruiterList,
        
        // Page 1 Section 3
        collectionSummary: {
          global: globalTotal,
          pro: proTotal,
          office: officeTotal,
          total: totalCollection
        },
        
        // Page 1 Section 4
        additionalCollections: additionalList,
        additionalSubtotal,
        
        // Detailed pivot data
        additionalColumns: uniqueHeads,
        additionalPivotRows: detailedAdditionalRows,
        
        // Page 1 Section 6
        grandTotal: totalCollection + additionalSubtotal,

        // Collection Distribution details
        collectionDistribution: {
          distributions: distributionList,
          totalDistributed,
          remainingTakafulBalance
        },
        
        // Page 2 & Section 5 rankings details
        detailedReport: {
          title: detailedReportTitle,
          columns: detailedReportColumns,
          rows: detailedReportRows,

          totalContributors: detailedReportRows.length,
          totalCollection: detailedReportTotal
        }
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
