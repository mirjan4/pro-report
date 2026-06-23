const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Presentation = require('./models/Presentation');
const Collection = require('./models/Collection');
const Pro = require('./models/Pro');
const Module = require('./models/Module');
const Sponsor = require('./models/Sponsor');
const Distribution = require('./models/Distribution');
const FinancialYear = require('./models/FinancialYear');

const MONTHS = ['April','May','June','July','August','September','October','November','December','January','February','March'];

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

async function compilePresentationData(presentation) {
  let fyId = 'all';
  if (presentation.financialYear) {
    const fyDoc = await FinancialYear.findById(presentation.financialYear);
    if (fyDoc) fyId = fyDoc.year;
  }

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

  if (presentation.module) {
    colFilter.module = presentation.module;
  }

  const collections = await Collection.find(colFilter)
    .populate('pro')
    .populate('module')
    .lean();

  let filteredCollections = collections;
  if (presentation.collectionFilter && presentation.collectionFilter !== 'all') {
    filteredCollections = collections.filter(c => {
      const code = c.module?.code || '';
      return code === presentation.collectionFilter;
    });
  }

  const total = filteredCollections.reduce((s, c) => s + (c.totalAmount || 0), 0);

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

  const proFilter = { status: 'active' };
  if (presentation.module) proFilter.module = presentation.module;
  const activeProsCount = await Pro.countDocuments(proFilter);
  const contributingProsCount = [...new Set(filteredCollections.filter(c => c.pro).map(c => c.pro._id.toString()))].length;

  const monthlySummary = MONTHS.map((month) => {
    const monthCols = filteredCollections.filter(c => c.month === month);
    return {
      month,
      total: monthCols.reduce((s, c) => s + (c.totalAmount || 0), 0)
    };
  });

  const modules = await Module.find({}).sort({ sortOrder: 1, name: 1 }).lean();
  const categoryShare = modules.map(mod => {
    const modCols = filteredCollections.filter(c => c.module && c.module._id.toString() === mod._id.toString());
    const value = modCols.reduce((s, c) => s + (c.totalAmount || 0), 0);
    return {
      name: mod.name,
      code: mod.code,
      color: mod.color,
      value,
      pct: total > 0 ? Number((value / total * 100).toFixed(1)) : 0
    };
  });

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
    const pid = c.pro._id.toString();
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
    const pid = c.pro._id.toString();
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

  const CollectionHead = require('./models/CollectionHead');
  const heads = await CollectionHead.find({ isActive: true }).lean();
  const headNames = heads.map(h => h.name);

  const directCollections = pros.map(p => {
    const pid = p._id.toString();
    const proCols = collections.filter(c => c.pro && c.pro._id.toString() === pid);
    
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

  const insights = [];
  if (total > 0) {
    const top3Sum = topContributors.slice(0, 3).reduce((s, r) => s + r.total, 0);
    const top3Pct = Math.round((top3Sum / total) * 100);
    insights.push(`Top 3 contributors generated ${top3Pct}% of total collections.`);
    
    const topCat = categoryShare.reduce((max, c) => c.value > max.value ? c : max, categoryShare[0] || { name: 'None', value: 0 });
    insights.push(`${topCat.name} remained the strongest collection category.`);
  }

  return {
    kpis: {
      totalCollection: total,
      growthPct: Math.round(growthPct * 100) / 100,
      prevCollection: prevTotal,
      activePros: activeProsCount,
      contributingPros: contributingProsCount,
      totalSponsors
    },
    insights
  };
}

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('DB connected.');

    const dummyPres = {
      collectionFilter: 'all',
      periodType: 'financialYear',
      financialYear: null,
      module: null
    };

    console.log('Compiling dummy data...');
    const result = await compilePresentationData(dummyPres);
    console.log('Success! Result compiled successfully:', Object.keys(result));
  } catch (err) {
    console.error('CRASH DETECTED:\n', err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
