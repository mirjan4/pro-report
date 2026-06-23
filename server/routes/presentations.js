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

// Helper for date ranges
function getFYDateRange(fyId) {
  if (!fyId || fyId === 'all') {
    const startDate = new Date(Date.UTC(2000, 0, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(2100, 11, 31, 23, 59, 59, 999));
    return { startDate, endDate };
  }
  const startYear = parseInt(fyId);
  const endYear = startYear + 1;
  const startDate = new Date(Date.UTC(startYear, 3, 1, 0, 0, 0));
  const endDate = new Date(Date.UTC(endYear, 2, 31, 23, 59, 59, 999));
  return { startDate, endDate };
}

// Unified compiler for Presentation slide deck data
async function compilePresentationData(presentation) {
  let fyId = 'all';
  if (presentation.financialYear) {
    if (presentation.financialYear.year) {
      fyId = presentation.financialYear.year;
    } else if (mongoose.Types.ObjectId.isValid(presentation.financialYear)) {
      const fyDoc = await FinancialYear.findById(presentation.financialYear);
      if (fyDoc) fyId = fyDoc.year; // e.g. "2025" or "2026"
    }
  }

  let targetModuleId = null;
  if (presentation.module) {
    if (presentation.module._id) {
      targetModuleId = presentation.module._id;
    } else if (mongoose.Types.ObjectId.isValid(presentation.module)) {
      targetModuleId = presentation.module;
    }
  }

  // 1. Fetch collections based on filters
  let colFilter = {};
  if (presentation.periodType === 'custom' && presentation.customRange && presentation.customRange.startDate) {
    colFilter.date = {
      $gte: new Date(presentation.customRange.startDate),
      $lte: new Date(presentation.customRange.endDate)
    };
  } else if (fyId !== 'all') {
    const { startDate, endDate } = getFYDateRange(fyId);
    colFilter.date = { $gte: startDate, $lte: endDate };
  }

  if (targetModuleId) {
    colFilter.module = targetModuleId;
  }

  const collections = await Collection.find(colFilter)
    .populate('pro')
    .populate('module')
    .lean();

  // Filter collections by collectionFilter
  let filteredCollections = collections;
  if (presentation.collectionFilter && presentation.collectionFilter !== 'all') {
    filteredCollections = collections.filter(c => {
      const code = c.module?.code || '';
      return code === presentation.collectionFilter;
    });
  }

  const total = filteredCollections.reduce((s, c) => s + (c.totalAmount || 0), 0);

  // Growth calculations
  let growthPct = 0, prevTotal = 0;
  if (presentation.periodType !== 'custom' && fyId !== 'all') {
    const startYear = parseInt(fyId);
    if (!isNaN(startYear)) {
      const prevStartYear = startYear - 1;
      const { startDate, endDate } = getFYDateRange(prevStartYear.toString());
      const prevCols = await Collection.find({ date: { $gte: startDate, $lte: endDate } })
        .populate('pro')
        .populate('module')
        .lean();
      
      let filteredPrevCols = prevCols;
      if (presentation.collectionFilter && presentation.collectionFilter !== 'all') {
        filteredPrevCols = prevCols.filter(c => c.module?.code === presentation.collectionFilter);
      }
      prevTotal = filteredPrevCols.reduce((s, c) => s + (c.totalAmount || 0), 0);
      growthPct = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0;
    }
  }

  // Active PROs count
  const proFilter = { status: 'active' };
  if (targetModuleId) proFilter.module = targetModuleId;
  const activeProsCount = await Pro.countDocuments(proFilter);
  const contributingProsCount = [...new Set(
    filteredCollections
      .filter(c => c.pro)
      .map(c => (c.pro._id ? c.pro._id.toString() : c.pro.toString()))
  )].length;

  // Monthly collection breakdown
  const monthlySummary = MONTHS.map((month) => {
    const monthCols = filteredCollections.filter(c => c.month === month);
    return {
      month,
      total: monthCols.reduce((s, c) => s + (c.totalAmount || 0), 0)
    };
  });

  // Category (Module) collection share
  const modules = await Module.find({}).sort({ sortOrder: 1, name: 1 }).lean();
  const categoryShare = modules.map(mod => {
    const modCols = filteredCollections.filter(c => {
      if (!c.module) return false;
      const modIdStr = c.module._id ? c.module._id.toString() : c.module.toString();
      return modIdStr === mod._id.toString();
    });
    const value = modCols.reduce((s, c) => s + (c.totalAmount || 0), 0);
    return {
      name: mod.name,
      code: mod.code,
      color: mod.color,
      value,
      pct: total > 0 ? Number((value / total * 100).toFixed(1)) : 0
    };
  });

  // Top Contributors rankings
  const proMap = {};
  const pros = await Pro.find({}).populate('module').lean();
  pros.forEach(p => {
    proMap[p._id.toString()] = {
      proId: p._id.toString(),
      name: p.name,
      area: p.area || 'N/A',
      designation: p.designation || 'PRO Officer',
      category: p.module?.name || 'N/A',
      takaful: 0,
      additional: 0,
      total: 0
    };
  });

  filteredCollections.forEach(c => {
    if (!c.pro) return;
    const pid = c.pro._id ? c.pro._id.toString() : c.pro.toString();
    if (proMap[pid]) {
      proMap[pid].takaful += (c.takafulAmount || 0);
      proMap[pid].additional += (c.additionalAmount || 0);
      proMap[pid].total += (c.totalAmount || 0);
    }
  });

  const recruiterRankings = Object.values(proMap)
    .sort((a, b) => b.total - a.total)
    .map((r, idx) => ({ ...r, rank: idx + 1 }));

  const topContributors = recruiterRankings.filter(r => r.total > 0).slice(0, 5);

  // 2. Fetch Sponsors
  let sponsorFilter = {};
  if (fyId !== 'all') {
    const { startDate, endDate } = getFYDateRange(fyId);
    sponsorFilter.date = { $gte: startDate, $lte: endDate };
  }
  const sponsors = await Sponsor.find(sponsorFilter).populate('pro').lean();
  const totalSponsors = sponsors.reduce((s, c) => s + (c.totalSponsors || 0), 0);
  const premiumCount = sponsors.reduce((s, c) => s + (c.premiumCount || 0), 0);
  const smartCount = sponsors.reduce((s, c) => s + (c.smartCount || 0), 0);
  const standardCount = sponsors.reduce((s, c) => s + (c.standardCount || 0), 0);

  const sponsorMonthlySummary = MONTHS.map((month) => {
    const monthRecs = sponsors.filter(c => c.month === month);
    return {
      month,
      premium: monthRecs.reduce((s, c) => s + (c.premiumCount || 0), 0),
      smart: monthRecs.reduce((s, c) => s + (c.smartCount || 0), 0),
      standard: monthRecs.reduce((s, c) => s + (c.standardCount || 0), 0),
      total: monthRecs.reduce((s, c) => s + (c.totalSponsors || 0), 0)
    };
  });

  const sponsorProMap = {};
  pros.forEach(p => {
    sponsorProMap[p._id.toString()] = {
      proId: p._id.toString(),
      name: p.name,
      area: p.area || 'N/A',
      premium: 0,
      smart: 0,
      standard: 0,
      total: 0,
      category: p.module?.name || 'N/A'
    };
  });
  sponsors.forEach(c => {
    if (!c.pro) return;
    const pid = c.pro._id ? c.pro._id.toString() : c.pro.toString();
    if (sponsorProMap[pid]) {
      sponsorProMap[pid].premium += (c.premiumCount || 0);
      sponsorProMap[pid].smart += (c.smartCount || 0);
      sponsorProMap[pid].standard += (c.standardCount || 0);
      sponsorProMap[pid].total += (c.totalSponsors || 0);
    }
  });

  const sponsorRankings = Object.values(sponsorProMap)
    .sort((a, b) => b.total - a.total)
    .filter(r => r.total > 0)
    .map((r, idx) => ({ ...r, rank: idx + 1 }));

  let cumulativeSponsors = 0;
  const sponsorGrowth = sponsorMonthlySummary.map(m => {
    cumulativeSponsors += m.total;
    return {
      month: m.month,
      added: m.total,
      cumulative: cumulativeSponsors
    };
  });

  // 3. Fetch Distributions
  let distFilter = {};
  if (fyId !== 'all') {
    const { startDate, endDate } = getFYDateRange(fyId);
    distFilter.date = { $gte: startDate, $lte: endDate };
  }
  const distributionsDocs = await Distribution.find(distFilter).lean();
  const distributionHeadMap = {};
  distributionsDocs.forEach(doc => {
    if (doc.distributions) {
      doc.distributions.forEach(d => {
        const headName = d.head;
        if (!distributionHeadMap[headName]) {
          distributionHeadMap[headName] = 0;
        }
        distributionHeadMap[headName] += (d.amount || 0);
      });
    }
  });

  const distributionAnalysis = Object.entries(distributionHeadMap).map(([head, value]) => ({
    name: head,
    value
  })).sort((a, b) => b.value - a.value);

  // 4. Direct collections through PROs detail
  const CollectionHead = require('../models/CollectionHead');
  const heads = await CollectionHead.find({ isActive: true }).lean();
  const headNames = heads.map(h => h.name);

  const directCollections = pros.map(p => {
    const pid = p._id.toString();
    const proCols = filteredCollections.filter(c => {
      if (!c.pro) return false;
      const cpid = c.pro._id ? c.pro._id.toString() : c.pro.toString();
      return cpid === pid;
    });
    
    const headAmounts = {};
    headNames.forEach(name => {
      headAmounts[name] = 0;
    });

    proCols.forEach(c => {
      if (c.additionalBreakdown) {
        c.additionalBreakdown.forEach(b => {
          if (headAmounts[b.head] !== undefined) {
            headAmounts[b.head] += (b.amount || 0);
          }
        });
      }
    });

    const totalAmount = proCols.reduce((s, c) => s + (c.totalAmount || 0), 0);

    return {
      proName: p.name,
      headAmounts,
      totalAmount
    };
  }).filter(d => d.totalAmount > 0).sort((a, b) => b.totalAmount - a.totalAmount);

  // 5. Generate AI Insights list
  const insights = [];
  if (total > 0) {
    const top3Sum = topContributors.slice(0, 3).reduce((s, r) => s + r.total, 0);
    const top3Pct = Math.round((top3Sum / total) * 100);
    insights.push(`Top 3 contributors generated ${top3Pct}% of total collections.`);
    
    const topCat = categoryShare.reduce((max, c) => c.value > max.value ? c : max, categoryShare[0] || { name: 'None', value: 0 });
    insights.push(`${topCat.name} remained the strongest collection category.`);
  }
  if (totalSponsors > 0) {
    insights.push(`Sponsor base grew to a total of ${totalSponsors} members.`);
  }
  if (insights.length === 0) {
    insights.push("Collection aggregates are steady across all units.");
    insights.push("Sponsor counts are stable with active recruiter follow-up.");
  }

  return {
    kpis: {
      totalCollection: total,
      growthPct: Math.round(growthPct * 100) / 100,
      prevCollection: prevTotal,
      activePros: activeProsCount,
      contributingPros: contributingProsCount,
      zeroPros: Math.max(0, activeProsCount - contributingProsCount),
      totalSponsors,
      premiumCount,
      smartCount,
      standardCount
    },
    monthlySummary,
    categoryShare,
    topContributors,
    recruiterRankings,
    sponsorMonthlySummary,
    sponsorRankings,
    sponsorGrowth,
    distributionAnalysis,
    directCollections,
    directCollectionHeads: headNames,
    insights
  };
}


// POST /api/presentations/preview-data — Pre-compile preview data (admin only)
router.post('/preview-data', protect, adminOnly, async (req, res) => {
  try {
    const data = await compilePresentationData(req.body);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/presentations — List presentations (admin only)
router.get('/', protect, adminOnly, async (req, res) => {
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

// GET /api/presentations/:id — Get presentation detail (admin only)
router.get('/:id', protect, adminOnly, async (req, res) => {
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
