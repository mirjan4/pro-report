import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import client from '../api/client';
import KPICard from '../components/KPICard';
import EChartWrapper from '../components/EChartWrapper';
import {
  HeartHandshake, Plus, Edit, Trash2, Check, X,
  Upload, Download, AlertTriangle, CheckCircle,
  TrendingUp, Users, Award, Sparkles, Layers,
  ChevronDown, BarChart3, LineChart, PieChart,
  FileText, FileSpreadsheet, Printer, RefreshCw,
  Search, Filter, Calendar, ArrowUpRight, Grid,
  Building, UserCheck, ChevronRight, Activity
} from 'lucide-react';
import * as XLSXRaw from 'xlsx';
import * as XLSXStyleModule from 'xlsx-js-style';
import XLSXStyleDefault from 'xlsx-js-style';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { ROBOTO_FONT_BASE64 } from '../assets/font';
import markazLogo from '../assets/markaz-logo.png';
import logo2 from '../assets/logo2.png';
import { motion, AnimatePresence } from 'framer-motion';

// Resolves the XLSX library correctly across Vite dev (ESM) and Vite production build (CJS / Rolldown bundle)
const getXLSX = () => {
  if (typeof window !== 'undefined' && window.XLSX && window.XLSX.utils) {
    return window.XLSX;
  }
  const sources = [XLSXStyleDefault, XLSXStyleModule];
  for (const src of sources) {
    if (!src) continue;
    if (src.utils && src.write) return src;
    if (src.default && src.default.utils && src.default.write) return src.default;
    if (typeof src === 'function') {
      try {
        const val = src();
        if (val && val.utils && val.write) return val;
      } catch (e) {}
    }
    if (typeof src.default === 'function') {
      try {
        const val = src.default();
        if (val && val.utils && val.write) return val;
      } catch (e) {}
    }
  }
  return XLSXStyleDefault || XLSXStyleModule;
};

const MONTHS = ['April','May','June','July','August','September','October','November','December','January','February','March'];

const SponsorEntry = () => {
  const { user, financialYears, selectedFY, pros, refreshMetadata } = useApp();
  const [sponsors, setSponsors] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [activeTab, setActiveTab] = useState(() => user?.role === 'analytics' ? 'reports' : 'registry'); // 'registry', 'reports', 'bulk'
  const [expandedMonths, setExpandedMonths] = useState({});

  // Sponsor Reports sub-navigation & filtering state
  const [reportSubTab, setReportSubTab] = useState('overview'); // 'overview', 'matrix', 'rankings', 'monthly'
  const [reportCategoryFilter, setReportCategoryFilter] = useState('all'); // 'all', 'pro', 'office'
  const [reportSearchQuery, setReportSearchQuery] = useState('');
  const [hideInactiveRecruiters, setHideInactiveRecruiters] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const allMonthsCollapsed = Object.values(expandedMonths).every(val => !val);

  const handleToggleAllMonths = () => {
    if (allMonthsCollapsed) {
      const updated = {};
      MONTHS.forEach(m => { updated[m] = true; });
      setExpandedMonths(updated);
    } else {
      setExpandedMonths({});
    }
  };

  const toggleMonth = (monthName) => {
    setExpandedMonths(prev => ({ ...prev, [monthName]: !prev[monthName] }));
  };

  const [selectedIds, setSelectedIds] = useState([]);

  // Form states (Single Entry)
  const [formMonth, setFormMonth] = useState('April');
  const [formYear, setFormYear] = useState(new Date().getFullYear());
  const [proId, setProId] = useState('');
  const [premiumCount, setPremiumCount] = useState('');
  const [smartCount, setSmartCount] = useState('');
  const [standardCount, setStandardCount] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Bulk Import States
  const [file, setFile] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [bulkError, setBulkError] = useState('');
  const [importReport, setImportReport] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  const activePros = pros.filter(p => p.status === 'active');

  const fetchData = async () => {
    setLoading(true);
    setAnalyticsLoading(true);
    try {
      const activeFY = selectedFY || financialYears.find(fy => fy.isActive) || financialYears[0];
      const fyParam = activeFY ? `?financialYear=${activeFY._id}&limit=2000` : '?limit=2000';

      // Get sponsor records
      const sponsorsRes = await client.get(`/api/sponsors${fyParam}`);
      if (sponsorsRes.data.success) {
        setSponsors(sponsorsRes.data.data);
      }

      // Get analytics reports
      const analyticsRes = await client.get(`/api/sponsors/analytics${activeFY ? `?financialYear=${activeFY._id}` : ''}`);
      if (analyticsRes.data.success) {
        setAnalytics(analyticsRes.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch sponsors data', err);
    } finally {
      setLoading(false);
      setAnalyticsLoading(false);
    }
  };

  const handleLiveSync = async () => {
    setSyncing(true);
    try {
      await Promise.all([fetchData(), refreshMetadata?.()]);
    } finally {
      setTimeout(() => setSyncing(false), 500);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedFY, financialYears]);

  useEffect(() => {
    if (activePros.length > 0 && !proId) setProId(activePros[0]._id);
  }, [pros]);

  useEffect(() => {
    if (user?.role === 'analytics') {
      setActiveTab('reports');
    }
  }, [user]);

  // Recruiter Classification Helper Functions (PRO vs Office)
  const isRecruiterOffice = (r) => {
    if (!r) return false;
    const name = (r.name || r.proName || r.pro?.name || '').trim().toLowerCase();
    const code = (r.categoryCode || r.module?.code || r.pro?.module?.code || '').toLowerCase();
    const cat = (r.category || r.module?.name || r.pro?.module?.name || '').toLowerCase();
    return code === 'ofc' || code === 'office' || cat.includes('office') || name === 'office' || name.includes('office');
  };

  const isRecruiterPro = (r) => !isRecruiterOffice(r);

  // Derive Comprehensive 12-Month Recruiter Matrix from pros and sponsors
  const recruiterMatrix = useMemo(() => {
    const map = new Map();

    // Initialize all registered recruiters from pros list
    pros.forEach(p => {
      const id = p._id ? p._id.toString() : String(p);
      const isOffice = isRecruiterOffice(p);
      map.set(id, {
        id,
        name: p.name || 'Unknown Officer',
        area: p.area || '—',
        category: isOffice ? 'Office Collection' : (p.module?.name || 'PRO Collection'),
        categoryCode: isOffice ? 'ofc' : (p.module?.code || 'pro'),
        status: p.status || 'active',
        months: {},
        annualPremium: 0,
        annualSmart: 0,
        annualStandard: 0,
        annualTotal: 0
      });
    });

    // Populate counts from database sponsor records
    sponsors.forEach(s => {
      const pid = s.pro?._id ? s.pro._id.toString() : (s.pro ? s.pro.toString() : '');
      if (!pid) return;

      if (!map.has(pid)) {
        const isOffice = isRecruiterOffice(s) || isRecruiterOffice(s.pro);
        map.set(pid, {
          id: pid,
          name: s.pro?.name || s.proName || 'Unknown Recruiter',
          area: s.pro?.area || '—',
          category: isOffice ? 'Office Collection' : (s.pro?.module?.name || 'PRO Collection'),
          categoryCode: isOffice ? 'ofc' : (s.pro?.module?.code || 'pro'),
          status: s.pro?.status || 'active',
          months: {},
          annualPremium: 0,
          annualSmart: 0,
          annualStandard: 0,
          annualTotal: 0
        });
      }

      const item = map.get(pid);
      const m = s.month;
      if (!item.months[m]) {
        item.months[m] = { premium: 0, smart: 0, standard: 0, total: 0 };
      }
      item.months[m].premium += (s.premiumCount || 0);
      item.months[m].smart += (s.smartCount || 0);
      item.months[m].standard += (s.standardCount || 0);
      item.months[m].total += (s.totalSponsors || 0);

      item.annualPremium += (s.premiumCount || 0);
      item.annualSmart += (s.smartCount || 0);
      item.annualStandard += (s.standardCount || 0);
      item.annualTotal += (s.totalSponsors || 0);
    });

    const rows = Array.from(map.values()).sort((a, b) => b.annualTotal - a.annualTotal);

    const columnTotals = {};
    MONTHS.forEach(m => {
      columnTotals[m] = { premium: 0, smart: 0, standard: 0, total: 0, activeCount: 0 };
    });

    rows.forEach(r => {
      MONTHS.forEach(m => {
        const md = r.months[m] || { premium: 0, smart: 0, standard: 0, total: 0 };
        columnTotals[m].premium += md.premium;
        columnTotals[m].smart += md.smart;
        columnTotals[m].standard += md.standard;
        columnTotals[m].total += md.total;
        if (md.total > 0) columnTotals[m].activeCount += 1;
      });
    });

    const grandTotal = rows.reduce((s, r) => s + r.annualTotal, 0);
    const grandPremium = rows.reduce((s, r) => s + r.annualPremium, 0);
    const grandSmart = rows.reduce((s, r) => s + r.annualSmart, 0);
    const grandStandard = rows.reduce((s, r) => s + r.annualStandard, 0);
    const activeRecruitersCount = rows.filter(r => r.annualTotal > 0).length;

    return {
      rows,
      columnTotals,
      grandTotal,
      grandPremium,
      grandSmart,
      grandStandard,
      totalRecruiters: rows.length,
      activeRecruitersCount
    };
  }, [pros, sponsors]);

  // Filtered matrix based on UI controls (PRO / Office / All + search + hideInactive)
  const filteredMatrix = useMemo(() => {
    let rows = recruiterMatrix.rows;

    if (reportCategoryFilter === 'pro') {
      rows = rows.filter(isRecruiterPro);
    } else if (reportCategoryFilter === 'office') {
      rows = rows.filter(isRecruiterOffice);
    }

    if (hideInactiveRecruiters) {
      rows = rows.filter(r => r.annualTotal > 0);
    }

    if (reportSearchQuery.trim()) {
      const q = reportSearchQuery.trim().toLowerCase();
      rows = rows.filter(r => r.name.toLowerCase().includes(q));
    }

    const colTotals = {};
    MONTHS.forEach(m => {
      colTotals[m] = { premium: 0, smart: 0, standard: 0, total: 0, activeCount: 0 };
    });

    rows.forEach(r => {
      MONTHS.forEach(m => {
        const md = r.months[m] || { premium: 0, smart: 0, standard: 0, total: 0 };
        colTotals[m].premium += md.premium;
        colTotals[m].smart += md.smart;
        colTotals[m].standard += md.standard;
        colTotals[m].total += md.total;
        if (md.total > 0) colTotals[m].activeCount += 1;
      });
    });

    const totalAnnual = rows.reduce((s, r) => s + r.annualTotal, 0);
    const totalPremium = rows.reduce((s, r) => s + r.annualPremium, 0);
    const totalSmart = rows.reduce((s, r) => s + r.annualSmart, 0);
    const totalStandard = rows.reduce((s, r) => s + r.annualStandard, 0);

    return {
      rows,
      colTotals,
      totalAnnual,
      totalPremium,
      totalSmart,
      totalStandard
    };
  }, [recruiterMatrix, reportCategoryFilter, hideInactiveRecruiters, reportSearchQuery]);

  // Filtered Recruiters based on active category filter (PRO / Office / All)
  const relevantRecruiters = useMemo(() => {
    let rows = recruiterMatrix.rows;
    if (reportCategoryFilter === 'pro') {
      rows = rows.filter(isRecruiterPro);
    } else if (reportCategoryFilter === 'office') {
      rows = rows.filter(isRecruiterOffice);
    }
    return rows;
  }, [recruiterMatrix.rows, reportCategoryFilter]);

  // Chronological Monthly Summary calculated dynamically for active category filter
  const filteredMonthlySummary = useMemo(() => {
    return MONTHS.map(month => {
      let premium = 0;
      let smart = 0;
      let standard = 0;
      let total = 0;
      let activeCount = 0;

      relevantRecruiters.forEach(r => {
        const md = r.months[month];
        if (md) {
          premium += (md.premium || 0);
          smart += (md.smart || 0);
          standard += (md.standard || 0);
          total += (md.total || 0);
          if (md.total > 0) activeCount += 1;
        }
      });

      return {
        month,
        premium,
        smart,
        standard,
        total,
        activeCount
      };
    });
  }, [relevantRecruiters]);

  // Aggregate KPIs calculated dynamically for active category filter
  const filteredKPIs = useMemo(() => {
    const totalSponsors = filteredMonthlySummary.reduce((s, m) => s + m.total, 0);
    const premiumCount = filteredMonthlySummary.reduce((s, m) => s + m.premium, 0);
    const smartCount = filteredMonthlySummary.reduce((s, m) => s + m.smart, 0);
    const standardCount = filteredMonthlySummary.reduce((s, m) => s + m.standard, 0);
    const activeRecruitersCount = relevantRecruiters.filter(r => r.annualTotal > 0).length;
    const totalRecruiters = relevantRecruiters.length;

    const proSponsors = recruiterMatrix.rows.filter(isRecruiterPro).reduce((s, r) => s + r.annualTotal, 0);
    const officeSponsors = recruiterMatrix.rows.filter(isRecruiterOffice).reduce((s, r) => s + r.annualTotal, 0);

    return {
      totalSponsors,
      premiumCount,
      smartCount,
      standardCount,
      activeRecruitersCount,
      totalRecruiters,
      proSponsors,
      officeSponsors
    };
  }, [filteredMonthlySummary, relevantRecruiters, recruiterMatrix.rows]);

  // Cumulative Growth Trend calculated dynamically for active category filter
  const filteredGrowthTrend = useMemo(() => {
    let cumulative = 0;
    return filteredMonthlySummary.map(m => {
      cumulative += m.total;
      return {
        month: m.month,
        added: m.total,
        cumulative
      };
    });
  }, [filteredMonthlySummary]);

  // Filtered Leaderboard Rankings (with search query support)
  const filteredRecruiterRankings = useMemo(() => {
    let rows = relevantRecruiters;
    if (reportSearchQuery.trim()) {
      const q = reportSearchQuery.trim().toLowerCase();
      rows = rows.filter(r => r.name.toLowerCase().includes(q));
    }
    return rows
      .slice()
      .sort((a, b) => b.annualTotal - a.annualTotal)
      .map((r, idx) => ({
        ...r,
        proId: r.id,
        rank: idx + 1,
        premium: r.annualPremium,
        smart: r.annualSmart,
        standard: r.annualStandard,
        total: r.annualTotal
      }));
  }, [relevantRecruiters, reportSearchQuery]);

  // Filtered Top Recruiters for Podium Cards
  const filteredTopRecruiters = useMemo(() => {
    return filteredRecruiterRankings.filter(r => r.total > 0).slice(0, 10);
  }, [filteredRecruiterRankings]);

  const openAddForm = (defaultMonth) => {
    setEditingEntry(null);
    let mVal = defaultMonth || MONTHS[0];
    const activeFY = selectedFY || financialYears.find(fy => fy.isActive) || financialYears[0];
    const startYear = activeFY && activeFY._id !== 'all' ? activeFY.startYear : new Date().getFullYear();
    const monthIdx = MONTHS.indexOf(mVal);
    const yVal = monthIdx >= 9 ? startYear + 1 : startYear;

    setFormMonth(mVal);
    setFormYear(yVal);

    if (activePros.length > 0) setProId(activePros[0]._id);
    setPremiumCount('');
    setSmartCount('');
    setStandardCount('');
    setNotes('');
    setError('');
    setSuccessMsg('');
    setFormOpen(true);
  };

  const openEditForm = (entry) => {
    setEditingEntry(entry);
    setFormMonth(entry.month || 'April');
    setFormYear(entry.year || new Date().getFullYear());
    setProId(entry.pro?._id || entry.pro || '');
    setPremiumCount(entry.premiumCount?.toString() || '0');
    setSmartCount(entry.smartCount?.toString() || '0');
    setStandardCount(entry.standardCount?.toString() || '0');
    setNotes(entry.notes || '');
    setError('');
    setSuccessMsg('');
    setFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formMonth || !formYear || !proId) {
      setError('Please select month, year, and Recruiter');
      return;
    }

    setError('');
    setSuccessMsg('');

    const entryData = {
      month: formMonth,
      year: Number(formYear),
      pro: proId,
      premiumCount: Number(premiumCount) || 0,
      smartCount: Number(smartCount) || 0,
      standardCount: Number(standardCount) || 0,
      notes
    };

    try {
      if (editingEntry) {
        const res = await client.put(`/api/sponsors/${editingEntry._id}`, entryData);
        if (res.data.success) {
          setSuccessMsg('Entry updated successfully!');
          fetchData();
        }
      } else {
        const res = await client.post('/api/sponsors', entryData);
        if (res.data.success) {
          setSuccessMsg('Entry created successfully!');
          fetchData();
        }
      }
      setTimeout(() => setFormOpen(false), 800);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit entry');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this sponsor record?')) return;
    try {
      const res = await client.delete(`/api/sponsors/${id}`);
      if (res.data.success) {
        fetchData();
      }
    } catch (err) {
      alert('Failed to delete record');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    if (!window.confirm(`Are you sure you want to delete the ${count} selected sponsor record(s)?`)) return;

    try {
      const res = await client.delete('/api/sponsors/bulk', { data: { ids: selectedIds } });
      if (res.data.success) {
        setSelectedIds([]);
        fetchData();
      }
    } catch (err) {
      alert('Failed to bulk delete sponsor records');
    }
  };

  // --- Bulk Import ---
  const downloadSampleTemplate = () => {
    const headers = ['Month', 'Year', 'PRO Name', 'Premium', 'Smart', 'Standard', 'Notes'];
    const sampleRows = [
      ['April', '2025', activePros[0]?.name || 'Ahmed Al-Rashidi', '10', '15', '25', ''],
      ['May', '2025', activePros[1]?.name || activePros[0]?.name || 'Fatima Malik', '8', '20', '30', 'On target']
    ];
    const csvContent = [headers.join(','), ...sampleRows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Sponsor_Count_Template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setBulkError('');
    setImportReport(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSXRaw.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const sheetRows = XLSXRaw.utils.sheet_to_json(sheet, { header: 1 });
        if (sheetRows.length === 0) {
          setBulkError('The uploaded file contains no data rows.');
          return;
        }

        const headers = (sheetRows[0] || []).map(h => String(h || '').trim());
        const requiredHeaders = ['Month', 'Year', 'PRO Name', 'Premium', 'Smart', 'Standard'];
        const missing = requiredHeaders.filter(h => !headers.includes(h));
        if (missing.length > 0) {
          setBulkError(`Missing required columns: ${missing.join(', ')}`);
          return;
        }

        const rows = XLSXRaw.utils.sheet_to_json(sheet);

        const validated = rows.map((row, index) => {
          const errors = [];
          const rawPro = row['PRO Name']?.toString().trim();

          const MONTH_MAP = {
            jan: 'January', january: 'January',
            feb: 'February', february: 'February',
            mar: 'March', march: 'March',
            apr: 'April', april: 'April',
            may: 'May',
            jun: 'June', june: 'June',
            jul: 'July', july: 'July',
            aug: 'August', august: 'August',
            sep: 'September', september: 'September',
            oct: 'October', october: 'October',
            nov: 'November', november: 'November',
            dec: 'December', december: 'December'
          };
          const rawMonthRaw = row['Month']?.toString().trim() || '';
          const cleanMonth = rawMonthRaw.toLowerCase();
          const rawMonth = MONTH_MAP[cleanMonth] || rawMonthRaw;

          const rawYear = Number(row['Year']);

          const parseCount = (val) => {
            if (val === undefined || val === null || String(val).trim() === '') return 0;
            return Number(val);
          };
          const rawPremium = parseCount(row['Premium']);
          const rawSmart = parseCount(row['Smart']);
          const rawStandard = parseCount(row['Standard']);

          if (!rawPro) errors.push('PRO Name is required');
          if (!rawMonthRaw || !MONTHS.includes(rawMonth)) errors.push(`Invalid Month name: "${rawMonthRaw}"`);
          if (isNaN(rawYear) || rawYear < 2000 || rawYear > 2100) errors.push('Invalid Year number');
          if (isNaN(rawPremium) || rawPremium < 0) errors.push('Premium must be positive number');
          if (isNaN(rawSmart) || rawSmart < 0) errors.push('Smart must be positive number');
          if (isNaN(rawStandard) || rawStandard < 0) errors.push('Standard must be positive number');

          const resolvedPRO = pros.find(p => p.name.toLowerCase().trim() === rawPro?.toLowerCase());
          if (rawPro && !resolvedPRO) {
            errors.push(`No active PRO officer matches name "${rawPro}"`);
          }

          const isDuplicate = sponsors.some(c =>
            c.pro?._id?.toString() === resolvedPRO?._id?.toString() &&
            c.month === rawMonth &&
            c.year === rawYear
          );

          const mIdx = MONTHS.indexOf(rawMonth);
          const startYear = mIdx >= 9 ? rawYear - 1 : rawYear;
          const endYear = startYear + 1;
          const fyLabel = isNaN(startYear) ? '—' : `FY ${startYear}-${String(endYear).substring(2)}`;

          return {
            rowNum: index + 2,
            month: rawMonth,
            year: rawYear,
            fyYear: fyLabel,
            proName: rawPro,
            proId: resolvedPRO?._id,
            premiumCount: rawPremium || 0,
            smartCount: rawSmart || 0,
            standardCount: rawStandard || 0,
            notes: row['Notes']?.toString().trim() || '',
            status: errors.length > 0 ? 'error' : isDuplicate ? 'duplicate' : 'valid',
            errors
          };
        });
        setParsedRows(validated);
      } catch (err) {
        setBulkError('Failed to parse file. Ensure it is a valid CSV or Excel file.');
      }
    };
    reader.readAsArrayBuffer(uploadedFile);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileUpload({ target: { files: [droppedFile] } });
  };

  const clearBulkState = () => {
    setFile(null); setParsedRows([]); setBulkError(''); setImportReport(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const executeBulkImport = async () => {
    const rowsToImport = parsedRows.filter(r => r.status !== 'error' && !(r.status === 'duplicate' && skipDuplicates));
    if (rowsToImport.length === 0) { alert('No valid rows to import.'); return; }

    setImporting(true);
    setBulkError('');
    const payload = rowsToImport.map(r => ({
      month: r.month,
      year: Number(r.year),
      pro: r.proId,
      premiumCount: r.premiumCount,
      smartCount: r.smartCount,
      standardCount: r.standardCount,
      notes: r.notes
    }));

    try {
      const res = await client.post('/api/sponsors/bulk', { entries: payload, skipDuplicates });
      if (res.data.success) {
        const { results } = res.data;
        setImportReport({
          total: parsedRows.length,
          attempted: payload.length,
          skipped: parsedRows.length - payload.length,
          inserted: results.inserted,
          updated: results.updated,
          failed: results.failed,
          errors: results.errors
        });
        fetchData();
        refreshMetadata();
      }
    } catch (err) {
      setBulkError(err.response?.data?.message || 'Bulk import server error');
    } finally {
      setImporting(false);
    }
  };

  // Helper to load image as HTMLImageElement for jsPDF
  const loadImage = (src) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = src;
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
    });
  };

  // =========================================================================
  // OFFICIAL EXECUTIVE PDF EXPORT ENGINE
  // =========================================================================
  const handleExportPDF = async () => {
    setExportingPDF(true);
    try {
      const [imgMarkaz, imgLogo2] = await Promise.all([
        loadImage(markazLogo),
        loadImage(logo2)
      ]);

      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });

      // Register Roboto font in jsPDF VFS
      doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_FONT_BASE64);
      doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
      doc.addFont('Roboto-Regular.ttf', 'Roboto', 'bold');
      doc.setFont('Roboto', 'normal');

      const pageWidth = doc.internal.pageSize.width; // 210mm
      const pageHeight = doc.internal.pageSize.height; // 297mm
      let currentY = 38;

      const fyLabel = selectedFY?.label || 'FY 2026-27';
      const kpis = filteredKPIs;
      const totalSponsors = kpis.totalSponsors || 0;
      const proSponsors = filteredKPIs.proSponsors || 0;
      const ofcSponsors = filteredKPIs.officeSponsors || 0;

      const tableOptions = {
        theme: 'grid',
        styles: {
          fontSize: 8,
          cellPadding: 1.8,
          valign: 'middle',
          lineColor: [140, 140, 140],
          lineWidth: 0.2,
          textColor: [0, 0, 0],
          font: 'Roboto'
        },
        headStyles: {
          fillColor: [243, 244, 246],
          textColor: [13, 27, 42],
          fontStyle: 'bold',
          lineColor: [100, 100, 100],
          lineWidth: 0.3
        }
      };

      // Helper to render section title text
      const renderSectionHeader = (title) => {
        doc.setFont('Roboto', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(13, 27, 42);
        if (currentY > 38) currentY += 5;
        doc.text(title, 10, currentY);
        currentY += 3.5;
      };

      // --- PAGE 1: EXECUTIVE OVERVIEW, TIER BREAKDOWN & TOP RECRUITERS ---
      
      // 1. Executive Metric Summary Boxes (Side-by-side)
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);

      const metricCards = [
        { label: 'TOTAL NEW SPONSORS', val: String(totalSponsors), sub: 'All Tiers Combined' },
        { label: 'PREMIUM TIER', val: String(kpis.premiumCount), sub: totalSponsors > 0 ? `${((kpis.premiumCount / totalSponsors) * 100).toFixed(1)}% Share` : '0%' },
        { label: 'SMART TIER', val: String(kpis.smartCount), sub: totalSponsors > 0 ? `${((kpis.smartCount / totalSponsors) * 100).toFixed(1)}% Share` : '0%' },
        { label: 'STANDARD TIER', val: String(kpis.standardCount), sub: totalSponsors > 0 ? `${((kpis.standardCount / totalSponsors) * 100).toFixed(1)}% Share` : '0%' }
      ];

      const boxW = 45;
      const boxH = 15;
      metricCards.forEach((c, idx) => {
        const xPos = 10 + (idx * 48.3);
        doc.setFillColor(250, 250, 252);
        doc.rect(xPos, currentY, boxW, boxH, 'FD');

        doc.setFont('Roboto', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 100, 100);
        doc.text(c.label, xPos + 3, currentY + 4.5);

        doc.setFont('Roboto', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(13, 27, 42);
        doc.text(c.val, xPos + 3, currentY + 10);

        doc.setFont('Roboto', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(120, 120, 120);
        doc.text(c.sub, xPos + 3, currentY + 13.5);
      });

      currentY += boxH + 4;

      // 2. Monthly Sponsor Acquisition Breakdown Table
      renderSectionHeader('MONTHLY SPONSOR ACQUISITION BREAKDOWN');

      const monthlyRows = filteredMonthlySummary.map(m => {
        const sharePct = totalSponsors > 0 ? `${((m.total / totalSponsors) * 100).toFixed(1)}%` : '0%';
        return [
          m.month,
          String(m.premium),
          String(m.smart),
          String(m.standard),
          String(m.total),
          sharePct
        ];
      });

      // Append Total Row
      monthlyRows.push([
        'TOTAL',
        String(kpis.premiumCount),
        String(kpis.smartCount),
        String(kpis.standardCount),
        String(kpis.totalSponsors),
        '100%'
      ]);

      doc.autoTable({
        ...tableOptions,
        head: [['MONTH', 'PREMIUM TIER', 'SMART TIER', 'STANDARD TIER', 'TOTAL SPONSORS', '% SHARE']],
        body: monthlyRows,
        startY: currentY,
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 40 },
          1: { halign: 'right', cellWidth: 30 },
          2: { halign: 'right', cellWidth: 30 },
          3: { halign: 'right', cellWidth: 30 },
          4: { halign: 'right', fontStyle: 'bold', cellWidth: 30 },
          5: { halign: 'right', fontStyle: 'bold', cellWidth: 30 }
        },
        didParseCell: (data) => {
          if (data.row.index === monthlyRows.length - 1 && data.section === 'body') {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [240, 240, 240];
          }
        }
      });

      currentY = doc.lastAutoTable.finalY + 3;

      // 3. Top Sponsor Recruiters Leaderboard Table
      renderSectionHeader('TOP SPONSOR RECRUITERS (LEADERBOARD)');

      const topRecs = (filteredTopRecruiters || []).slice(0, 10).map((r, idx) => {
        const sharePct = totalSponsors > 0 ? `${((r.total / totalSponsors) * 100).toFixed(1)}%` : '0%';
        return [
          `#${idx + 1}`,
          r.name,
          String(r.premium),
          String(r.smart),
          String(r.standard),
          String(r.total),
          sharePct
        ];
      });

      if (topRecs.length === 0) {
        topRecs.push(['—', 'No recruiter submissions recorded', '0', '0', '0', '0', '0%']);
      }

      doc.autoTable({
        ...tableOptions,
        head: [['RANK', 'RECRUITER NAME', 'PREMIUM TIER', 'SMART TIER', 'STANDARD TIER', 'TOTAL SPONSORS', 'SHARE %']],
        body: topRecs,
        startY: currentY,
        columnStyles: {
          0: { halign: 'center', fontStyle: 'bold', cellWidth: 16 },
          1: { fontStyle: 'bold', cellWidth: 64 },
          2: { halign: 'right', cellWidth: 22 },
          3: { halign: 'right', cellWidth: 22 },
          4: { halign: 'right', cellWidth: 22 },
          5: { halign: 'right', fontStyle: 'bold', cellWidth: 24 },
          6: { halign: 'right', fontStyle: 'bold', cellWidth: 20 }
        }
      });

      // --- PAGE 2: 12-MONTH RECRUITER MASTER MATRIX & GRAND TOTAL ---
      doc.addPage();
      currentY = 38;

      renderSectionHeader('12-MONTH RECRUITER SPONSOR ACQUISITION MASTER MATRIX');

      const matrixRows = filteredMatrix.rows
        .filter(r => r.annualTotal > 0 || r.status === 'active')
        .map((r, idx) => {
          const mCounts = MONTHS.map(m => {
            const count = r.months[m]?.total || 0;
            return count > 0 ? String(count) : '-';
          });
          return [
            String(idx + 1),
            r.name,
            ...mCounts,
            String(r.annualTotal)
          ];
        });

      // Add Footer Row with monthly sums
      const matrixFooter = [
        '',
        'TOTAL SPONSORS',
        ...MONTHS.map(m => String(filteredMatrix.colTotals[m]?.total || 0)),
        String(filteredMatrix.totalAnnual)
      ];
      matrixRows.push(matrixFooter);

      doc.autoTable({
        ...tableOptions,
        styles: {
          ...tableOptions.styles,
          fontSize: 7.5,
          cellPadding: 1.5
        },
        head: [['SL', 'RECRUITER NAME', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'JAN', 'FEB', 'MAR', 'TOTAL']],
        body: matrixRows,
        startY: currentY,
        columnStyles: {
          0: { halign: 'center', cellWidth: 8 },
          1: { fontStyle: 'bold', cellWidth: 48 },
          2: { halign: 'center', cellWidth: 9.5 },
          3: { halign: 'center', cellWidth: 9.5 },
          4: { halign: 'center', cellWidth: 9.5 },
          5: { halign: 'center', cellWidth: 9.5 },
          6: { halign: 'center', cellWidth: 9.5 },
          7: { halign: 'center', cellWidth: 9.5 },
          8: { halign: 'center', cellWidth: 9.5 },
          9: { halign: 'center', cellWidth: 9.5 },
          10: { halign: 'center', cellWidth: 9.5 },
          11: { halign: 'center', cellWidth: 9.5 },
          12: { halign: 'center', cellWidth: 9.5 },
          13: { halign: 'center', cellWidth: 9.5 },
          14: { halign: 'right', fontStyle: 'bold', cellWidth: 20 }
        },
        didParseCell: (data) => {
          if (data.row.index === matrixRows.length - 1 && data.section === 'body') {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [240, 240, 240];
          }
          if (data.section === 'body' && data.column.index >= 2 && data.column.index <= 13) {
            const val = data.cell.text.join('').trim();
            if (val !== '-' && val !== '0' && data.row.index !== matrixRows.length - 1) {
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      });

      currentY = doc.lastAutoTable.finalY;

      // Render Grand Total Callout Box
      if (currentY + 20 > pageHeight - 25) {
        doc.addPage();
        currentY = 38;
      } else {
        currentY += 6;
      }

      const filterBadge = reportCategoryFilter === 'pro' ? ' [PRO]' : reportCategoryFilter === 'office' ? ' [OFFICE]' : '';
      const totalText = `GRAND TOTAL SPONSORS${filterBadge} : ${filteredMatrix.totalAnnual.toLocaleString('en-IN')}`;
      doc.setFont('Roboto', 'bold');
      doc.setFontSize(14);
      const textWidth = doc.getTextWidth(totalText);
      const boxWidth = Math.max(textWidth + 24, 120);
      const boxHeight = 11;
      const boxX = 105 - (boxWidth / 2);

      doc.setDrawColor(13, 27, 42);
      doc.setLineWidth(0.6);
      doc.setFillColor(255, 253, 230); // Light Yellow
      doc.rect(boxX, currentY, boxWidth, boxHeight, 'FD');

      doc.setTextColor(13, 27, 42);
      doc.text(totalText, 105, currentY + 7.8, { align: 'center' });

      // --- POST-PROCESSING: Dynamic Headers, Footers, and Page Numbers on All Pages ---
      const pageCount = doc.internal.getNumberOfPages();
      const genTime = new Date().toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);

        // 1. Dark Blue Header Strip
        doc.setFillColor(13, 27, 42); // #0D1B2A
        doc.rect(10, 10, 190, 18, 'F');

        // Draw Logos
        if (imgMarkaz) {
          doc.addImage(imgMarkaz, 'PNG', 12, 12, 14, 14);
        }
        if (imgLogo2) {
          doc.addImage(imgLogo2, 'PNG', 184, 12, 14, 14);
        }

        // 2. Centered Gold Title
        doc.setFont('Roboto', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(245, 197, 24); // #F5C518
        doc.text('MARKAZ TAKAFUL — SPONSOR TRACKING REPORT', 105, 17, { align: 'center' });

        // 3. Centered Gray Subtitle
        doc.setFont('Roboto', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(220, 220, 220);
        const catSubtitle = reportCategoryFilter === 'pro' ? 'PRO Officers Collection' : reportCategoryFilter === 'office' ? 'Office Collection' : 'Comprehensive Performance';
        doc.text(`${fyLabel} • ${catSubtitle} & Tier Distribution Matrix`, 105, 23, { align: 'center' });

        // 4. Horizontal Divider Line
        doc.setDrawColor(102, 102, 102);
        doc.setLineWidth(0.4);
        doc.line(10, 32, 200, 32);

        // 5. Footer Details
        doc.setFont('Roboto', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(80, 80, 80);

        doc.text('Verified By ___________________', 10, 287);
        doc.text(`Generated On: ${genTime}`, 105, 287, { align: 'center' });
        doc.text(`Page: ${i} of ${pageCount}`, 200, 287, { align: 'right' });
      }

      const safeLabel = `${(selectedFY?.label || 'FY').replace(/[^a-zA-Z0-9]/g, '_')}_${reportCategoryFilter.toUpperCase()}`;
      doc.save(`Sponsor_Tracking_Report_${safeLabel}.pdf`);
    } catch (err) {
      console.error('Failed to export PDF:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setExportingPDF(false);
    }
  };

  // =========================================================================
  // OFFICIAL STYLED EXCEL WORKBOOK EXPORT ENGINE (xlsx-js-style)
  // =========================================================================
  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      const XLSX = getXLSX();
      const workbook = XLSX.utils.book_new();

      const makeCell = (val, type, style, numFmt) => {
        const cell = { v: val, t: type, s: style };
        if (numFmt) cell.z = numFmt;
        return cell;
      };

      const styles = {
        title: {
          font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: 'F5C518' } },
          fill: { fgColor: { rgb: '0D1B2A' } },
          alignment: { horizontal: 'center', vertical: 'center' }
        },
        subtitle: {
          font: { name: 'Calibri', sz: 10, italic: true, color: { rgb: 'DCDCDC' } },
          fill: { fgColor: { rgb: '0D1B2A' } },
          alignment: { horizontal: 'center', vertical: 'center' }
        },
        sectionHeader: {
          font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: '0D1B2A' } },
          alignment: { horizontal: 'center', vertical: 'center' }
        },
        tableHeader: {
          font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '0D1B2A' } },
          fill: { fgColor: { rgb: 'E5E7EB' } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: 'CCCCCC' } },
            bottom: { style: 'medium', color: { rgb: '999999' } },
            left: { style: 'thin', color: { rgb: 'CCCCCC' } },
            right: { style: 'thin', color: { rgb: 'CCCCCC' } }
          }
        },
        tableHeaderLeft: {
          font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '0D1B2A' } },
          fill: { fgColor: { rgb: 'E5E7EB' } },
          alignment: { horizontal: 'left', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: 'CCCCCC' } },
            bottom: { style: 'medium', color: { rgb: '999999' } },
            left: { style: 'thin', color: { rgb: 'CCCCCC' } },
            right: { style: 'thin', color: { rgb: 'CCCCCC' } }
          }
        },
        cellNormal: {
          font: { name: 'Calibri', sz: 10, color: { rgb: '000000' } },
          alignment: { horizontal: 'left', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: 'E5E7EB' } },
            bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
            left: { style: 'thin', color: { rgb: 'E5E7EB' } },
            right: { style: 'thin', color: { rgb: 'E5E7EB' } }
          }
        },
        cellNormalCenter: {
          font: { name: 'Calibri', sz: 10, color: { rgb: '000000' } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: 'E5E7EB' } },
            bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
            left: { style: 'thin', color: { rgb: 'E5E7EB' } },
            right: { style: 'thin', color: { rgb: 'E5E7EB' } }
          }
        },
        cellNormalRight: {
          font: { name: 'Calibri', sz: 10, color: { rgb: '000000' } },
          alignment: { horizontal: 'right', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: 'E5E7EB' } },
            bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
            left: { style: 'thin', color: { rgb: 'E5E7EB' } },
            right: { style: 'thin', color: { rgb: 'E5E7EB' } }
          }
        },
        cellShadedNormal: {
          font: { name: 'Calibri', sz: 10, color: { rgb: '000000' } },
          fill: { fgColor: { rgb: 'F9FAFB' } },
          alignment: { horizontal: 'left', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: 'E5E7EB' } },
            bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
            left: { style: 'thin', color: { rgb: 'E5E7EB' } },
            right: { style: 'thin', color: { rgb: 'E5E7EB' } }
          }
        },
        cellShadedRight: {
          font: { name: 'Calibri', sz: 10, color: { rgb: '000000' } },
          fill: { fgColor: { rgb: 'F9FAFB' } },
          alignment: { horizontal: 'right', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: 'E5E7EB' } },
            bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
            left: { style: 'thin', color: { rgb: 'E5E7EB' } },
            right: { style: 'thin', color: { rgb: 'E5E7EB' } }
          }
        },
        cellShadedCenter: {
          font: { name: 'Calibri', sz: 10, color: { rgb: '000000' } },
          fill: { fgColor: { rgb: 'F9FAFB' } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: 'E5E7EB' } },
            bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
            left: { style: 'thin', color: { rgb: 'E5E7EB' } },
            right: { style: 'thin', color: { rgb: 'E5E7EB' } }
          }
        },
        cellBoldNormal: {
          font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '000000' } },
          fill: { fgColor: { rgb: 'F3F4F6' } },
          alignment: { horizontal: 'left', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: '999999' } },
            bottom: { style: 'thin', color: { rgb: '999999' } },
            left: { style: 'thin', color: { rgb: '999999' } },
            right: { style: 'thin', color: { rgb: '999999' } }
          }
        },
        cellBoldRight: {
          font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '000000' } },
          fill: { fgColor: { rgb: 'F3F4F6' } },
          alignment: { horizontal: 'right', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: '999999' } },
            bottom: { style: 'thin', color: { rgb: '999999' } },
            left: { style: 'thin', color: { rgb: '999999' } },
            right: { style: 'thin', color: { rgb: '999999' } }
          }
        },
        grandTotal: {
          font: { name: 'Calibri', sz: 13, bold: true, color: { rgb: '0D1B2A' } },
          fill: { fgColor: { rgb: 'FFFDE6' } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: {
            top: { style: 'medium', color: { rgb: '0D1B2A' } },
            bottom: { style: 'medium', color: { rgb: '0D1B2A' } },
            left: { style: 'medium', color: { rgb: '0D1B2A' } },
            right: { style: 'medium', color: { rgb: '0D1B2A' } }
          }
        }
      };

      const autoFitCols = (ws, rows) => {
        const colWidths = [];
        rows.forEach((row, rIdx) => {
          if (rIdx <= 1) return;
          row.forEach((cell, cIdx) => {
            let val = "";
            if (cell && cell.v !== undefined && cell.v !== null) val = String(cell.v);
            const len = val.length;
            if (!colWidths[cIdx] || len > colWidths[cIdx]) colWidths[cIdx] = len;
          });
        });
        ws['!cols'] = colWidths.map(w => ({ wch: Math.max((w || 0) + 3, 11) }));
      };

      const fyLabel = selectedFY?.label || 'FY 2026-27';
      const kpis = filteredKPIs;
      const totalSponsors = kpis.totalSponsors || 0;
      const catSubtitle = reportCategoryFilter === 'pro' ? 'PRO Officers Collection' : reportCategoryFilter === 'office' ? 'Office Collection' : 'Comprehensive';

      // =========================================================================
      // SHEET 1: EXECUTIVE SUMMARY
      // =========================================================================
      const s1Rows = [];
      const s1Merges = [];
      const s1MaxCols = 6;

      // Header Banner
      s1Rows.push(Array.from({ length: s1MaxCols }, (_, i) => i === 0 ? makeCell('MARKAZ TAKAFUL — SPONSOR TRACKING REPORT', 's', styles.title) : {}));
      s1Merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: s1MaxCols - 1 } });

      s1Rows.push(Array.from({ length: s1MaxCols }, (_, i) => i === 0 ? makeCell(`${fyLabel} • ${catSubtitle} Summary & Monthly Intake`, 's', styles.subtitle) : {}));
      s1Merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: s1MaxCols - 1 } });

      s1Rows.push(Array.from({ length: s1MaxCols }, () => ({}))); // Spacer

      // Section 1: KPI Overview Tables side by side
      const kpiTitleRow = Array.from({ length: s1MaxCols }, () => ({}));
      kpiTitleRow[0] = makeCell('SPONSORS BY TIER', 's', styles.sectionHeader);
      kpiTitleRow[3] = makeCell('RECRUITER CATEGORY SHARE', 's', styles.sectionHeader);
      s1Rows.push(kpiTitleRow);
      s1Merges.push({ s: { r: s1Rows.length - 1, c: 0 }, e: { r: s1Rows.length - 1, c: 1 } });
      s1Merges.push({ s: { r: s1Rows.length - 1, c: 3 }, e: { r: s1Rows.length - 1, c: 4 } });

      const tierItems = [
        ['Premium Tier', kpis.premiumCount],
        ['Smart Tier', kpis.smartCount],
        ['Standard Tier', kpis.standardCount],
        ['Total Sponsors', totalSponsors]
      ];

      const catItems = [
        ['PRO Recruiters', filteredKPIs.proSponsors || 0],
        ['Office Staff Recruiters', filteredKPIs.officeSponsors || 0],
        ['Active Contributing Officers', filteredKPIs.activeRecruitersCount],
        ['Total Recruiter Base', filteredKPIs.totalRecruiters]
      ];

      for (let i = 0; i < 4; i++) {
        const row = Array.from({ length: s1MaxCols }, () => ({}));
        const t = tierItems[i];
        const c = catItems[i];
        const isBold = i === 3;
        const styleL = isBold ? styles.cellBoldNormal : styles.cellNormal;
        const styleR = isBold ? styles.cellBoldRight : styles.cellNormalRight;

        row[0] = makeCell(t[0], 's', styleL);
        row[1] = makeCell(t[1], 'n', styleR, '#,##0');

        row[3] = makeCell(c[0], 's', styleL);
        row[4] = makeCell(c[1], 'n', styleR, '#,##0');

        s1Rows.push(row);
      }

      s1Rows.push(Array.from({ length: s1MaxCols }, () => ({}))); // Spacer

      // Section 2: Monthly Breakdown Table
      const mTitleRow = Array.from({ length: s1MaxCols }, () => ({}));
      mTitleRow[0] = makeCell('MONTHLY SPONSOR INTAKE BREAKDOWN', 's', styles.sectionHeader);
      s1Rows.push(mTitleRow);
      s1Merges.push({ s: { r: s1Rows.length - 1, c: 0 }, e: { r: s1Rows.length - 1, c: s1MaxCols - 1 } });

      const mHeaderRow = Array.from({ length: s1MaxCols }, () => ({}));
      mHeaderRow[0] = makeCell('MONTH', 's', styles.tableHeaderLeft);
      mHeaderRow[1] = makeCell('PREMIUM TIER', 's', styles.tableHeader);
      mHeaderRow[2] = makeCell('SMART TIER', 's', styles.tableHeader);
      mHeaderRow[3] = makeCell('STANDARD TIER', 's', styles.tableHeader);
      mHeaderRow[4] = makeCell('TOTAL SPONSORS', 's', styles.tableHeader);
      mHeaderRow[5] = makeCell('% SHARE', 's', styles.tableHeader);
      s1Rows.push(mHeaderRow);

      filteredMonthlySummary.forEach((m, idx) => {
        const row = Array.from({ length: s1MaxCols }, () => ({}));
        const isShaded = idx % 2 === 1;
        const styleL = isShaded ? styles.cellShadedNormal : styles.cellNormal;
        const styleR = isShaded ? styles.cellShadedRight : styles.cellNormalRight;
        const share = totalSponsors > 0 ? ((m.total / totalSponsors) * 100).toFixed(1) + '%' : '0%';

        row[0] = makeCell(m.month, 's', styleL);
        row[1] = makeCell(m.premium, 'n', styleR, '#,##0');
        row[2] = makeCell(m.smart, 'n', styleR, '#,##0');
        row[3] = makeCell(m.standard, 'n', styleR, '#,##0');
        row[4] = makeCell(m.total, 'n', styleR, '#,##0');
        row[5] = makeCell(share, 's', styleR);

        s1Rows.push(row);
      });

      // Total Row
      const mTotalRow = Array.from({ length: s1MaxCols }, () => ({}));
      mTotalRow[0] = makeCell('TOTAL', 's', styles.cellBoldNormal);
      mTotalRow[1] = makeCell(kpis.premiumCount, 'n', styles.cellBoldRight, '#,##0');
      mTotalRow[2] = makeCell(kpis.smartCount, 'n', styles.cellBoldRight, '#,##0');
      mTotalRow[3] = makeCell(kpis.standardCount, 'n', styles.cellBoldRight, '#,##0');
      mTotalRow[4] = makeCell(totalSponsors, 'n', styles.cellBoldRight, '#,##0');
      mTotalRow[5] = makeCell('100.0%', 's', styles.cellBoldRight);
      s1Rows.push(mTotalRow);

      s1Rows.push(Array.from({ length: s1MaxCols }, () => ({}))); // Spacer

      // Grand Total Callout Box
      const gtRowIdx = s1Rows.length;
      const filterBadge = reportCategoryFilter === 'pro' ? ' [PRO]' : reportCategoryFilter === 'office' ? ' [OFFICE]' : '';
      const gtRow = Array.from({ length: s1MaxCols }, (_, i) => i === 0 ? makeCell(`GRAND TOTAL SPONSORS${filterBadge} : ${filteredMatrix.totalAnnual.toLocaleString('en-IN')}`, 's', styles.grandTotal) : {});
      s1Rows.push(gtRow);
      s1Merges.push({ s: { r: gtRowIdx, c: 0 }, e: { r: gtRowIdx, c: s1MaxCols - 1 } });

      const sheet1 = XLSX.utils.aoa_to_sheet(s1Rows);
      sheet1['!merges'] = s1Merges;
      autoFitCols(sheet1, s1Rows);
      XLSX.utils.book_append_sheet(workbook, sheet1, 'Executive Summary');

      // =========================================================================
      // SHEET 2: RECRUITER RANKINGS
      // =========================================================================
      const s2Rows = [];
      const s2Merges = [];
      const s2MaxCols = 7;

      s2Rows.push(Array.from({ length: s2MaxCols }, (_, i) => i === 0 ? makeCell('RECRUITER PERFORMANCE RANKINGS', 's', styles.title) : {}));
      s2Merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: s2MaxCols - 1 } });

      s2Rows.push(Array.from({ length: s2MaxCols }, (_, i) => i === 0 ? makeCell(`${fyLabel} • ${catSubtitle} Cumulative enrollments`, 's', styles.subtitle) : {}));
      s2Merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: s2MaxCols - 1 } });

      s2Rows.push(Array.from({ length: s2MaxCols }, () => ({}))); // Spacer

      const rankHeaders = ['RANK', 'RECRUITER NAME', 'PREMIUM TIER', 'SMART TIER', 'STANDARD TIER', 'TOTAL SPONSORS', 'CONTRIBUTION %'];
      const rHeaderRow = Array.from({ length: s2MaxCols }, (_, i) => i === 1 ? makeCell(rankHeaders[i], 's', styles.tableHeaderLeft) : makeCell(rankHeaders[i], 's', styles.tableHeader));
      s2Rows.push(rHeaderRow);

      const allRankings = filteredRecruiterRankings;
      allRankings.forEach((r, idx) => {
        const row = Array.from({ length: s2MaxCols }, () => ({}));
        const isShaded = idx % 2 === 1;
        const styleL = isShaded ? styles.cellShadedNormal : styles.cellNormal;
        const styleR = isShaded ? styles.cellShadedRight : styles.cellNormalRight;
        const styleC = isShaded ? styles.cellShadedCenter : styles.cellNormalCenter;
        const share = totalSponsors > 0 ? ((r.total / totalSponsors) * 100).toFixed(1) + '%' : '0%';

        row[0] = makeCell(idx + 1, 'n', styleC);
        row[1] = makeCell(r.name, 's', styleL);
        row[2] = makeCell(r.premium, 'n', styleR, '#,##0');
        row[3] = makeCell(r.smart, 'n', styleR, '#,##0');
        row[4] = makeCell(r.standard, 'n', styleR, '#,##0');
        row[5] = makeCell(r.total, 'n', styleR, '#,##0');
        row[6] = makeCell(share, 's', styleR);

        s2Rows.push(row);
      });

      const sheet2 = XLSX.utils.aoa_to_sheet(s2Rows);
      sheet2['!merges'] = s2Merges;
      autoFitCols(sheet2, s2Rows);
      XLSX.utils.book_append_sheet(workbook, sheet2, 'Recruiter Rankings');

      // =========================================================================
      // SHEET 3: 12-MONTH RECRUITER MASTER MATRIX
      // =========================================================================
      const s3Rows = [];
      const s3Merges = [];
      const s3MaxCols = 15;

      s3Rows.push(Array.from({ length: s3MaxCols }, (_, i) => i === 0 ? makeCell('12-MONTH RECRUITER SPONSOR ACQUISITION MASTER MATRIX', 's', styles.title) : {}));
      s3Merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: s3MaxCols - 1 } });

      s3Rows.push(Array.from({ length: s3MaxCols }, (_, i) => i === 0 ? makeCell(`${fyLabel} • ${catSubtitle} Month-by-month enrollment matrix`, 's', styles.subtitle) : {}));
      s3Merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: s3MaxCols - 1 } });

      s3Rows.push(Array.from({ length: s3MaxCols }, () => ({}))); // Spacer

      const matrixHeaderTitles = ['SL NO', 'RECRUITER NAME', ...MONTHS.map(m => m.toUpperCase()), 'ANNUAL TOTAL'];
      const mtxHeaderRow = Array.from({ length: s3MaxCols }, (_, i) => i === 1 ? makeCell(matrixHeaderTitles[i], 's', styles.tableHeaderLeft) : makeCell(matrixHeaderTitles[i], 's', styles.tableHeader));
      s3Rows.push(mtxHeaderRow);

      filteredMatrix.rows.forEach((r, idx) => {
        const row = Array.from({ length: s3MaxCols }, () => ({}));
        const isShaded = idx % 2 === 1;
        const styleL = isShaded ? styles.cellShadedNormal : styles.cellNormal;
        const styleR = isShaded ? styles.cellShadedRight : styles.cellNormalRight;
        const styleC = isShaded ? styles.cellShadedCenter : styles.cellNormalCenter;

        row[0] = makeCell(idx + 1, 'n', styleC);
        row[1] = makeCell(r.name, 's', styleL);

        MONTHS.forEach((m, mIdx) => {
          const count = r.months[m]?.total || 0;
          row[2 + mIdx] = makeCell(count, 'n', styleC, '#,##0');
        });

        row[14] = makeCell(r.annualTotal, 'n', styleR, '#,##0');
        s3Rows.push(row);
      });

      // Total Row
      const mtxTotalRow = Array.from({ length: s3MaxCols }, () => ({}));
      mtxTotalRow[0] = makeCell('', 's', styles.cellBoldNormal);
      mtxTotalRow[1] = makeCell('MONTHLY TOTALS', 's', styles.cellBoldNormal);

      MONTHS.forEach((m, mIdx) => {
        const sum = filteredMatrix.colTotals[m]?.total || 0;
        mtxTotalRow[2 + mIdx] = makeCell(sum, 'n', styles.cellBoldRight, '#,##0');
      });

      mtxTotalRow[14] = makeCell(filteredMatrix.totalAnnual, 'n', styles.cellBoldRight, '#,##0');
      s3Rows.push(mtxTotalRow);

      const sheet3 = XLSX.utils.aoa_to_sheet(s3Rows);
      sheet3['!merges'] = s3Merges;
      autoFitCols(sheet3, s3Rows);
      XLSX.utils.book_append_sheet(workbook, sheet3, '12-Month Matrix');

      // Export file via Blob and download URL
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8'
      });
      const downloadUrl = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.href = downloadUrl;
      const safeLabel = `${(selectedFY?.label || 'FY').replace(/[^a-zA-Z0-9]/g, '_')}_${reportCategoryFilter.toUpperCase()}`;
      downloadLink.download = `Sponsor_Tracking_Report_${safeLabel}.xlsx`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      setTimeout(() => {
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(downloadUrl);
      }, 200);
    } catch (err) {
      console.error('Failed to export Excel:', err);
      alert('Failed to generate Excel report: ' + (err?.message || 'Unknown error'));
    } finally {
      setExportingExcel(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Dynamic Filter-Aware ECharts Configurations for Visual Analytics
  const monthlySummaryChartOption = useMemo(() => {
    if (!analytics) return {};
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(13, 27, 42, 0.95)',
        borderColor: 'rgba(245, 197, 24, 0.4)',
        textStyle: { color: '#fff' }
      },
      legend: {
        textStyle: { color: '#9ca3af' },
        data: ['Premium', 'Smart', 'Standard', 'Total Sponsors']
      },
      grid: { left: '3%', right: '3%', bottom: '3%', top: '15%', containLabel: true },
      xAxis: {
        type: 'category',
        data: MONTHS.map(m => m.substring(0, 3)),
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: { color: '#9ca3af' }
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
        axisLabel: { color: '#9ca3af' }
      },
      series: [
        { name: 'Premium', type: 'bar', stack: 'counts', data: filteredMonthlySummary.map(m => m.premium), itemStyle: { color: '#f5c518' } },
        { name: 'Smart', type: 'bar', stack: 'counts', data: filteredMonthlySummary.map(m => m.smart), itemStyle: { color: '#3b82f6' } },
        { name: 'Standard', type: 'bar', stack: 'counts', data: filteredMonthlySummary.map(m => m.standard), itemStyle: { color: '#10b981' } },
        { name: 'Total Sponsors', type: 'line', data: filteredMonthlySummary.map(m => m.total), itemStyle: { color: '#ffffff' }, lineStyle: { width: 2.5 } }
      ]
    };
  }, [analytics, filteredMonthlySummary]);

  const categoryShareChartOption = useMemo(() => {
    if (!analytics) return {};
    let pieData = [];
    if (reportCategoryFilter === 'pro') {
      pieData = [
        { value: filteredKPIs.proSponsors || 0, name: 'PRO Officers (Active Filter)', itemStyle: { color: '#f5c518' } }
      ];
    } else if (reportCategoryFilter === 'office') {
      pieData = [
        { value: filteredKPIs.officeSponsors || 0, name: 'Office Staff (Active Filter)', itemStyle: { color: '#3b82f6' } }
      ];
    } else {
      pieData = [
        { value: filteredKPIs.proSponsors || 0, name: 'PRO Officers', itemStyle: { color: '#f5c518' } },
        { value: filteredKPIs.officeSponsors || 0, name: 'Office Staff', itemStyle: { color: '#3b82f6' } }
      ];
    }

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)',
        backgroundColor: 'rgba(13, 27, 42, 0.95)',
        borderColor: 'rgba(245, 197, 24, 0.4)',
        textStyle: { color: '#fff' }
      },
      legend: { bottom: '5%', left: 'center', textStyle: { color: '#9ca3af' } },
      series: [
        {
          name: 'Sponsor Recruiters',
          type: 'pie',
          radius: ['45%', '68%'],
          padAngle: 3,
          itemStyle: { borderRadius: 8 },
          label: { show: false },
          emphasis: { label: { show: true, fontSize: 13, fontWeight: 'bold', formatter: '{b}\n{c}', color: '#fff' } },
          data: pieData
        }
      ]
    };
  }, [analytics, filteredKPIs, reportCategoryFilter]);

  const tierShareChartOption = useMemo(() => {
    if (!analytics) return {};
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} sponsors ({d}%)',
        backgroundColor: 'rgba(13, 27, 42, 0.95)',
        borderColor: 'rgba(245, 197, 24, 0.4)',
        textStyle: { color: '#fff' }
      },
      legend: { bottom: '5%', left: 'center', textStyle: { color: '#9ca3af' } },
      series: [
        {
          name: 'Tier Distribution',
          type: 'pie',
          radius: ['45%', '68%'],
          padAngle: 3,
          itemStyle: { borderRadius: 8 },
          label: { show: false },
          emphasis: { label: { show: true, fontSize: 13, fontWeight: 'bold', formatter: '{b}\n{c} ({d}%)', color: '#fff' } },
          data: [
            { value: filteredKPIs.premiumCount || 0, name: 'Premium Tier', itemStyle: { color: '#f5c518' } },
            { value: filteredKPIs.smartCount || 0, name: 'Smart Tier', itemStyle: { color: '#3b82f6' } },
            { value: filteredKPIs.standardCount || 0, name: 'Standard Tier', itemStyle: { color: '#10b981' } }
          ]
        }
      ]
    };
  }, [analytics, filteredKPIs]);

  const growthChartOption = useMemo(() => {
    if (!analytics) return {};
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(13, 27, 42, 0.95)',
        borderColor: 'rgba(245, 197, 24, 0.4)',
        textStyle: { color: '#fff' }
      },
      grid: { left: '3%', right: '3%', bottom: '3%', top: '10%', containLabel: true },
      xAxis: {
        type: 'category',
        data: MONTHS.map(m => m.substring(0, 3)),
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: { color: '#9ca3af' }
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
        axisLabel: { color: '#9ca3af' }
      },
      series: [
        {
          name: 'Cumulative Sponsors',
          type: 'line',
          smooth: true,
          symbolSize: 8,
          itemStyle: { color: '#f5c518' },
          lineStyle: { width: 3, shadowBlur: 10, shadowColor: 'rgba(245, 197, 24, 0.4)' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(245, 197, 24, 0.28)' },
                { offset: 1, color: 'transparent' }
              ]
            }
          },
          data: filteredGrowthTrend.map(g => g.cumulative)
        }
      ]
    };
  }, [analytics, filteredGrowthTrend]);

  const totalSponsorsCount = filteredKPIs.totalSponsors || 0;
  const premiumSharePct = totalSponsorsCount > 0 ? (((filteredKPIs.premiumCount || 0) / totalSponsorsCount) * 100).toFixed(1) : '0';
  const smartSharePct = totalSponsorsCount > 0 ? (((filteredKPIs.smartCount || 0) / totalSponsorsCount) * 100).toFixed(1) : '0';
  const standardSharePct = totalSponsorsCount > 0 ? (((filteredKPIs.standardCount || 0) / totalSponsorsCount) * 100).toFixed(1) : '0';
  const proSharePct = recruiterMatrix.grandTotal > 0 ? (((filteredKPIs.proSponsors || 0) / recruiterMatrix.grandTotal) * 100).toFixed(1) : '0';

  return (
    <div className="p-6 space-y-6">
      {/* Print Page Styles Override */}
      <style dangerouslySetInnerHTML={{ __html: `
        @page {
          size: A4 portrait;
          margin: 15mm 10mm;
        }
        @media print {
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          nav, aside, header, .no-print, button, .action-btn {
            display: none !important;
          }
          .glass-card, .border {
            background: transparent !important;
            box-shadow: none !important;
            border-color: #cccccc !important;
            color: #000000 !important;
          }
          .text-white {
            color: #000000 !important;
          }
          .text-gray-400, .text-gray-500 {
            color: #555555 !important;
          }
          .gold-gradient-text {
            color: #0D1B2A !important;
            -webkit-text-fill-color: #0D1B2A !important;
          }
        }
      `}} />

      {/* Header Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Sponsor <span className="gold-gradient-text">Tracking Portal</span>
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border border-gold/30 bg-gold/10 text-gold">
              <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
              Sponsors Mode
            </span>
            <p className="text-gray-400 text-sm">
              Official sponsor counts & recruiter matrix — <span className="text-white font-semibold">{selectedFY?.label || 'Current Period'}</span>
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center flex-wrap gap-2.5 no-print">
          <button
            onClick={handleLiveSync}
            disabled={syncing}
            title="Refresh database records"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-white/10 bg-white/5 hover:bg-white/10 text-gray-200 hover:text-white transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-gold' : ''}`} />
            <span>{syncing ? 'Syncing...' : 'Sync'}</span>
          </button>

          <button
            onClick={handleExportPDF}
            disabled={exportingPDF}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-gold/30 bg-gold/10 hover:bg-gold/20 text-gold transition-all cursor-pointer disabled:opacity-50"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{exportingPDF ? 'Generating PDF...' : 'Export PDF'}</span>
          </button>

          <button
            onClick={handleExportExcel}
            disabled={exportingExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-all cursor-pointer disabled:opacity-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{exportingExcel ? 'Exporting...' : 'Export Excel'}</span>
          </button>

          <button
            onClick={handlePrint}
            title="Print Sponsor Report"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>

          {user?.role === 'admin' && (
            <button
              onClick={() => openAddForm(null)}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-extrabold transition-all duration-200 glow-btn text-dark-bg bg-gradient-to-r from-gold to-gold-accent hover:shadow-lg cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Entry</span>
            </button>
          )}
        </div>
      </div>

      {/* Primary Tab Navigation */}
      <div className="flex space-x-2 border-b border-white/5 pb-2 no-print">
        {[
          { id: 'registry', label: 'Sponsor Registry', icon: Layers },
          { id: 'reports', label: 'Sponsor Reports & Analytics', icon: BarChart3 },
          { id: 'bulk', label: 'Bulk Import', icon: Upload }
        ].filter(t => t.id !== 'bulk' || user?.role === 'admin').map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${
              activeTab === t.id ? 'bg-gradient-to-r from-gold to-gold-accent text-dark-bg font-extrabold shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* ============ REGISTRY TAB ============ */}
      {activeTab === 'registry' && (
        <div className="space-y-4">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard title="Total Sponsors" value={analytics?.kpis.totalSponsors || 0} icon={HeartHandshake} isCurrency={false} subtitle="All Categories" />
            <KPICard title="Premium Sponsors" value={analytics?.kpis.premiumCount || 0} icon={Award} isCurrency={false} subtitle="High Tier" />
            <KPICard title="Smart Sponsors" value={analytics?.kpis.smartCount || 0} icon={Sparkles} isCurrency={false} subtitle="Mid Tier" />
            <KPICard title="Standard Sponsors" value={analytics?.kpis.standardCount || 0} icon={Users} isCurrency={false} subtitle="Base Tier" />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-gold" />
            </div>
          ) : (() => {
            const sponsorsByMonth = MONTHS.reduce((acc, m) => {
              acc[m] = sponsors.filter(c => c.month === m);
              return acc;
            }, {});

            return (
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-white/5 border border-white/10 p-4 rounded-2xl">
                  <div className="text-xs text-gray-400 font-medium">
                    Total: <span className="text-white font-bold">{sponsors.length} records</span> across <span className="text-white font-bold">{MONTHS.filter(m => sponsorsByMonth[m].length > 0).length} active months</span>
                  </div>
                  <button
                    onClick={handleToggleAllMonths}
                    className="px-4 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    {allMonthsCollapsed ? 'Expand All' : 'Collapse All'}
                  </button>
                </div>

                <div className="space-y-4">
                  {MONTHS.map(m => {
                    const monthEntries = sponsorsByMonth[m] || [];
                    const premiumTotal = monthEntries.reduce((sum, c) => sum + (c.premiumCount || 0), 0);
                    const smartTotal = monthEntries.reduce((sum, c) => sum + (c.smartCount || 0), 0);
                    const standardTotal = monthEntries.reduce((sum, c) => sum + (c.standardCount || 0), 0);
                    const monthTotal = monthEntries.reduce((sum, c) => sum + (c.totalSponsors || 0), 0);
                    const isExpanded = !!expandedMonths[m];
                    const entryCount = monthEntries.length;

                    return (
                      <div key={m} className={`glass-card rounded-2xl overflow-hidden border transition-all duration-300 ${isExpanded ? 'border-white/10 bg-white/[0.02]' : 'border-white/5 bg-transparent'}`}>
                        {/* Month Accordion Header */}
                        <div 
                          onClick={() => toggleMonth(m)}
                          className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors gap-4 select-none"
                        >
                          <div className="flex items-center gap-4">
                            <h3 className="text-lg font-bold text-white min-w-[100px]">{m}</h3>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${entryCount > 0 ? 'bg-gold/10 text-gold border border-gold/20' : 'bg-gray-500/10 text-gray-400 border border-white/5'}`}>
                              {entryCount} Recruiter{entryCount !== 1 ? 's' : ''}
                            </span>
                          </div>

                          <div className="flex items-center gap-6">
                            <div className="hidden sm:flex items-center gap-4 text-xs">
                              <span className="text-gray-400">Prem: <strong className="text-white">{premiumTotal}</strong></span>
                              <span className="text-gray-400">Smart: <strong className="text-white">{smartTotal}</strong></span>
                              <span className="text-gray-400">Std: <strong className="text-white">{standardTotal}</strong></span>
                              <span className="text-gold font-extrabold border-l border-white/10 pl-4">Total: {monthTotal}</span>
                            </div>

                            {user?.role === 'admin' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); openAddForm(m); }}
                                className="p-1.5 rounded-lg bg-gold/10 text-gold hover:bg-gold/20 border border-gold/30 transition-all cursor-pointer"
                                title="Add entry for this month"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            )}

                            <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                          </div>
                        </div>

                        {/* Month Accordion Body */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="border-t border-white/5 bg-black/20"
                            >
                              {entryCount === 0 ? (
                                <div className="p-8 text-center text-gray-500 text-sm">
                                  No sponsor records submitted for {m}.
                                </div>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs text-left">
                                    <thead>
                                      <tr className="border-b border-white/5 text-gray-400 uppercase font-semibold">
                                        <th className="px-4 py-3">Recruiter Name</th>
                                        <th className="px-4 py-3 text-center">Premium</th>
                                        <th className="px-4 py-3 text-center">Smart</th>
                                        <th className="px-4 py-3 text-center">Standard</th>
                                        <th className="px-4 py-3 text-center font-bold text-gold">Total</th>
                                        <th className="px-4 py-3">Notes</th>
                                        {user?.role === 'admin' && <th className="px-4 py-3 text-right">Actions</th>}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                      {monthEntries.map(entry => (
                                        <tr key={entry._id} className="hover:bg-white/[0.02] transition-colors">
                                          <td className="px-4 py-3 font-semibold text-white">
                                            {entry.pro?.name || entry.proName || 'Unknown Recruiter'}
                                          </td>
                                          <td className="px-4 py-3 text-center font-medium text-gray-200">{entry.premiumCount || 0}</td>
                                          <td className="px-4 py-3 text-center font-medium text-gray-200">{entry.smartCount || 0}</td>
                                          <td className="px-4 py-3 text-center font-medium text-gray-200">{entry.standardCount || 0}</td>
                                          <td className="px-4 py-3 text-center font-extrabold text-gold">{entry.totalSponsors || 0}</td>
                                          <td className="px-4 py-3 text-gray-400 max-w-xs truncate">{entry.notes || '—'}</td>
                                          {user?.role === 'admin' && (
                                            <td className="px-4 py-3 text-right space-x-2">
                                              <button
                                                onClick={() => openEditForm(entry)}
                                                className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-all cursor-pointer"
                                                title="Edit Entry"
                                              >
                                                <Edit className="w-3.5 h-3.5" />
                                              </button>
                                              <button
                                                onClick={() => handleDelete(entry._id)}
                                                className="p-1.5 text-rose-400/80 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-all cursor-pointer"
                                                title="Delete Entry"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </td>
                                          )}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>

                {/* Grand Total Cumulative */}
                <div className="glass-card rounded-2xl p-5 border border-white/10 bg-white/[0.02] flex items-center justify-between gap-4 mt-6">
                  <div>
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">Annual Sponsors Summary</h4>
                    <p className="text-xs text-gray-500 mt-0.5 font-medium">Cumulative counts recruited in selected period</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block">Grand Total Sponsors</span>
                    <span className="text-2xl font-extrabold text-gold">
                      {sponsors.reduce((s, c) => s + (c.totalSponsors || 0), 0)}
                    </span>
                    <span className="text-xs text-gray-400 block mt-0.5">{sponsors.length} recruiter submissions</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* =========================================================================
          SPONSOR REPORTS & EXECUTIVE REPORTING HUB TAB
          ========================================================================= */}
      {activeTab === 'reports' && (
        <div className="space-y-6 animate-fadeIn">
          {analyticsLoading ? (
            <div className="flex items-center justify-center py-24">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold" />
            </div>
          ) : !analytics ? (
            <div className="glass-card p-12 text-center text-gray-500 text-sm">
              No sponsor reporting data available for the selected financial year.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Executive 6-KPI Metric Ribbon */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
                <div className="glass-card p-4 rounded-2xl border border-white/10 bg-white/[0.02]">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    {reportCategoryFilter === 'pro' ? 'PRO Sponsors' : reportCategoryFilter === 'office' ? 'Office Sponsors' : 'Total Sponsors'}
                  </span>
                  <div className="text-2xl font-extrabold text-white">{totalSponsorsCount}</div>
                  <span className="text-[11px] text-gold font-bold mt-1 inline-flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    {reportCategoryFilter === 'pro' ? 'PRO Subtotal' : reportCategoryFilter === 'office' ? 'Office Subtotal' : '100% Intake'}
                  </span>
                </div>

                <div className="glass-card p-4 rounded-2xl border border-gold/20 bg-gold/[0.03]">
                  <span className="text-[10px] font-bold text-gold uppercase tracking-wider block mb-1">Premium Tier</span>
                  <div className="text-2xl font-extrabold text-gold">{filteredKPIs.premiumCount}</div>
                  <span className="text-[11px] text-gray-400 font-medium mt-1 block">
                    {premiumSharePct}% of total
                  </span>
                </div>

                <div className="glass-card p-4 rounded-2xl border border-blue-500/20 bg-blue-500/[0.03]">
                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block mb-1">Smart Tier</span>
                  <div className="text-2xl font-extrabold text-blue-400">{filteredKPIs.smartCount}</div>
                  <span className="text-[11px] text-gray-400 font-medium mt-1 block">
                    {smartSharePct}% of total
                  </span>
                </div>

                <div className="glass-card p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03]">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">Standard Tier</span>
                  <div className="text-2xl font-extrabold text-emerald-400">{filteredKPIs.standardCount}</div>
                  <span className="text-[11px] text-gray-400 font-medium mt-1 block">
                    {standardSharePct}% of total
                  </span>
                </div>

                <div className="glass-card p-4 rounded-2xl border border-purple-500/20 bg-purple-500/[0.03]">
                  <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block mb-1">
                    {reportCategoryFilter === 'office' ? 'Office Recruiter' : 'Contributing Officers'}
                  </span>
                  <div className="text-2xl font-extrabold text-white">
                    {filteredKPIs.activeRecruitersCount} <span className="text-xs text-gray-400 font-normal">/ {filteredKPIs.totalRecruiters}</span>
                  </div>
                  <span className="text-[11px] text-purple-400 font-medium mt-1 block">
                    {filteredKPIs.totalRecruiters > 0 ? ((filteredKPIs.activeRecruitersCount / filteredKPIs.totalRecruiters) * 100).toFixed(0) : 0}% Active
                  </span>
                </div>

                <div className="glass-card p-4 rounded-2xl border border-pink-500/20 bg-pink-500/[0.03]">
                  <span className="text-[10px] font-bold text-pink-400 uppercase tracking-wider block mb-1">Category Share</span>
                  <div className="text-2xl font-extrabold text-white">
                    {reportCategoryFilter === 'pro' ? '100%' : reportCategoryFilter === 'office' ? '100%' : `${proSharePct}%`}
                    <span className="text-xs text-gray-400 font-normal ml-1">
                      {reportCategoryFilter === 'pro' ? 'PRO' : reportCategoryFilter === 'office' ? 'Office' : 'PRO'}
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-400 font-medium mt-1 block">
                    {reportCategoryFilter === 'all'
                      ? `Office: ${(100 - Number(proSharePct)).toFixed(1)}%`
                      : `Filter: ${reportCategoryFilter.toUpperCase()}`}
                  </span>
                </div>
              </div>

              {/* Sub-Tabs & Filtering Control Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-card p-3 rounded-2xl border border-white/10 bg-white/[0.01] no-print">
                {/* Sub Tab View Buttons */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
                  {[
                    { id: 'overview', label: 'Overview & Visual Analytics', icon: BarChart3 },
                    { id: 'matrix', label: '12-Month Recruiter Matrix', icon: Grid },
                    { id: 'rankings', label: 'Recruiter Leaderboard', icon: Award },
                    { id: 'monthly', label: 'Monthly Tier Breakdown', icon: Calendar }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setReportSubTab(tab.id)}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                        reportSubTab === tab.id
                          ? 'bg-gold text-dark-bg font-extrabold shadow-sm'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <tab.icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>

                {/* Sub-Tab Filter Pills */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-black/40 rounded-xl p-1 border border-white/10 text-xs">
                    <button
                      onClick={() => setReportCategoryFilter('all')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                        reportCategoryFilter === 'all' ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setReportCategoryFilter('pro')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                        reportCategoryFilter === 'pro' ? 'bg-gold/20 text-gold' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      PRO
                    </button>
                    <button
                      onClick={() => setReportCategoryFilter('office')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                        reportCategoryFilter === 'office' ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Office
                    </button>
                  </div>

                  {reportSubTab === 'matrix' && (
                    <button
                      onClick={() => setHideInactiveRecruiters(h => !h)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        hideInactiveRecruiters
                          ? 'bg-gold/15 text-gold border-gold/30'
                          : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
                      }`}
                    >
                      {hideInactiveRecruiters ? 'Active Only' : 'Show All'}
                    </button>
                  )}
                </div>
              </div>

              {/* ============ SUB-TAB 1: OVERVIEW & VISUAL ANALYTICS ============ */}
              {reportSubTab === 'overview' && (
                <div className="space-y-6">
                  {/* Visual Analytics Row 1 */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Monthly Intake Bar Chart */}
                    <div className="lg:col-span-2 glass-card rounded-2xl p-6 border border-white/10">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                          <BarChart3 className="w-5 h-5 text-gold" />
                          Monthly New Sponsors Intake by Tier
                        </h3>
                        <span className="text-xs text-gray-400 font-medium">Stacked Tier Volume</span>
                      </div>
                      <div className="h-80">
                        <EChartWrapper option={monthlySummaryChartOption} />
                      </div>
                    </div>

                    {/* Tier Share Donut Chart */}
                    <div className="glass-card rounded-2xl p-6 border border-white/10">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                          <PieChart className="w-5 h-5 text-gold" />
                          Tier Distribution
                        </h3>
                        <span className="text-xs text-gray-400 font-medium">Share %</span>
                      </div>
                      <div className="h-80">
                        <EChartWrapper option={tierShareChartOption} />
                      </div>
                    </div>
                  </div>

                  {/* Visual Analytics Row 2 */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Category Share Donut */}
                    <div className="glass-card rounded-2xl p-6 border border-white/10">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                          <Building className="w-5 h-5 text-gold" />
                          Recruiter Category Share
                        </h3>
                        <span className="text-xs text-gray-400 font-medium">PRO vs Office</span>
                      </div>
                      <div className="h-80">
                        <EChartWrapper option={categoryShareChartOption} />
                      </div>
                    </div>

                    {/* Cumulative Growth Trend */}
                    <div className="lg:col-span-2 glass-card rounded-2xl p-6 border border-white/10">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                          <TrendingUp className="w-5 h-5 text-gold" />
                          Sponsor Acquisition Growth Curve (Cumulative)
                        </h3>
                        <span className="text-xs text-gray-400 font-medium">FY Progress</span>
                      </div>
                      <div className="h-80">
                        <EChartWrapper option={growthChartOption} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ============ SUB-TAB 2: 12-MONTH RECRUITER MASTER MATRIX ============ */}
              {reportSubTab === 'matrix' && (
                <div className="space-y-4">
                  {/* Matrix Toolbar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={reportSearchQuery}
                        onChange={e => setReportSearchQuery(e.target.value)}
                        placeholder="Search recruiter name..."
                        className="w-full bg-[#0d1b2a]/60 border border-white/10 focus:border-gold rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none"
                      />
                    </div>
                    <div className="text-xs text-gray-400">
                      Showing <span className="text-white font-bold">{filteredMatrix.rows.length}</span> of {recruiterMatrix.rows.length} recruiters
                    </div>
                  </div>

                  {/* Master Matrix Table */}
                  <div className="glass-card rounded-2xl overflow-hidden border border-white/10">
                    <div className="overflow-x-auto max-h-[600px]">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead className="sticky top-0 bg-[#0d1b2a] z-10 shadow-sm border-b border-white/10">
                          <tr className="text-gray-400 uppercase tracking-wider font-semibold">
                            <th className="px-3 py-3 w-12 text-center">#</th>
                            <th className="px-4 py-3 min-w-[200px]">Recruiter Name</th>
                            {MONTHS.map(m => (
                              <th key={m} className="px-3 py-3 text-center min-w-[55px] font-bold">
                                {m.substring(0, 3)}
                              </th>
                            ))}
                            <th className="px-4 py-3 text-right font-bold text-gold min-w-[90px]">Annual Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {filteredMatrix.rows.map((r, idx) => (
                            <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                              <td className="px-3 py-2.5 text-center text-gray-500 font-mono">#{idx + 1}</td>
                              <td className="px-4 py-2.5 font-semibold text-white">
                                {r.name}
                              </td>
                              {MONTHS.map(m => {
                                const count = r.months[m]?.total || 0;
                                return (
                                  <td key={m} className="px-3 py-2.5 text-center">
                                    {count > 0 ? (
                                      <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-gold/15 text-gold border border-gold/30">
                                        {count}
                                      </span>
                                    ) : (
                                      <span className="text-gray-600 font-mono">-</span>
                                    )}
                                  </td>
                                );
                              })}
                              <td className="px-4 py-2.5 text-right font-extrabold text-gold text-sm">
                                {r.annualTotal}
                              </td>
                            </tr>
                          ))}

                          {filteredMatrix.rows.length === 0 && (
                            <tr>
                              <td colSpan="15" className="text-center py-10 text-gray-500">
                                No recruiters match the active search / category criteria.
                              </td>
                            </tr>
                          )}
                        </tbody>
                        <tfoot className="sticky bottom-0 bg-[#0d1b2a] border-t-2 border-white/20 shadow-lg">
                          <tr className="font-extrabold text-white">
                            <td colSpan="2" className="px-4 py-3 text-gold uppercase tracking-wider text-xs">
                              Monthly Column Totals
                            </td>
                            {MONTHS.map(m => (
                              <td key={m} className="px-3 py-3 text-center text-xs font-bold text-white">
                                {filteredMatrix.colTotals[m]?.total || 0}
                              </td>
                            ))}
                            <td className="px-4 py-3 text-right text-base text-gold font-extrabold">
                              {filteredMatrix.totalAnnual}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ============ SUB-TAB 3: RECRUITER LEADERBOARD & RANKINGS ============ */}
              {reportSubTab === 'rankings' && (
                <div className="space-y-6">
                  {/* Top Podium Highlights (Supports 1, 2, or 3+ recruiters) */}
                  {filteredTopRecruiters.length > 0 && (
                    <div className={`grid grid-cols-1 ${
                      filteredTopRecruiters.length === 1
                        ? 'max-w-md mx-auto'
                        : filteredTopRecruiters.length === 2
                        ? 'md:grid-cols-2 max-w-2xl mx-auto'
                        : 'md:grid-cols-3'
                    } gap-4`}>
                      {/* #2 Silver (Shown if 2 or more recruiters) */}
                      {filteredTopRecruiters.length >= 2 && (
                        <div className="glass-card p-5 rounded-2xl border border-slate-400/20 bg-slate-400/[0.02] flex flex-col justify-between">
                          <div className="flex items-center justify-between">
                            <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-slate-400/10 text-slate-300 border border-slate-400/30">
                              Rank #2 • Silver
                            </span>
                            <Award className="w-5 h-5 text-slate-300" />
                          </div>
                          <div className="my-4">
                            <h4 className="text-lg font-bold text-white">{filteredTopRecruiters[1]?.name}</h4>
                            <span className="text-xs text-gray-400 font-medium">Contributing Officer</span>
                          </div>
                          <div className="flex items-center justify-between border-t border-white/5 pt-3">
                            <span className="text-xs text-gray-400">Total Enrolled</span>
                            <span className="text-xl font-extrabold text-white">{filteredTopRecruiters[1]?.total}</span>
                          </div>
                        </div>
                      )}

                      {/* #1 Gold Champion */}
                      <div className="glass-card p-5 rounded-2xl border border-gold/40 bg-gold/[0.05] relative overflow-hidden flex flex-col justify-between shadow-lg shadow-gold/5">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gold/10 rounded-full blur-2xl pointer-events-none" />
                        <div className="flex items-center justify-between">
                          <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-gold/20 text-gold border border-gold/40 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5" /> Rank #1 • Champion
                          </span>
                          <Award className="w-6 h-6 text-gold" />
                        </div>
                        <div className="my-4">
                          <h4 className="text-xl font-extrabold text-white">{filteredTopRecruiters[0]?.name}</h4>
                          <span className="text-xs text-gray-300 font-medium">Top Performer</span>
                        </div>
                        <div className="flex items-center justify-between border-t border-gold/20 pt-3">
                          <span className="text-xs text-gold font-bold">Total Enrolled</span>
                          <span className="text-2xl font-black text-gold">{filteredTopRecruiters[0]?.total}</span>
                        </div>
                      </div>

                      {/* #3 Bronze (Shown if 3 or more recruiters) */}
                      {filteredTopRecruiters.length >= 3 && (
                        <div className="glass-card p-5 rounded-2xl border border-amber-600/20 bg-amber-600/[0.02] flex flex-col justify-between">
                          <div className="flex items-center justify-between">
                            <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-600/10 text-amber-500 border border-amber-600/30">
                              Rank #3 • Bronze
                            </span>
                            <Award className="w-5 h-5 text-amber-500" />
                          </div>
                          <div className="my-4">
                            <h4 className="text-lg font-bold text-white">{filteredTopRecruiters[2]?.name}</h4>
                            <span className="text-xs text-gray-400 font-medium">Contributing Officer</span>
                          </div>
                          <div className="flex items-center justify-between border-t border-white/5 pt-3">
                            <span className="text-xs text-gray-400">Total Enrolled</span>
                            <span className="text-xl font-extrabold text-white">{filteredTopRecruiters[2]?.total}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Full Leaderboard Table */}
                  <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <Award className="w-5 h-5 text-gold" />
                        Complete Recruiter Performance Leaderboard
                      </h3>
                      <span className="text-xs text-gray-400">
                        {filteredRecruiterRankings.length} registered recruiters
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/5 text-gray-400 uppercase tracking-wider font-semibold">
                            <th className="px-4 py-3 w-16 text-center">Rank</th>
                            <th className="px-4 py-3">Recruiter Name</th>
                            <th className="px-4 py-3 text-center">Premium</th>
                            <th className="px-4 py-3 text-center">Smart</th>
                            <th className="px-4 py-3 text-center">Standard</th>
                            <th className="px-4 py-3 text-center font-bold text-gold">Total</th>
                            <th className="px-4 py-3 min-w-[120px]">Share %</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {filteredRecruiterRankings.map((r, idx) => {
                            const share = totalSponsorsCount > 0 ? ((r.total / totalSponsorsCount) * 100).toFixed(1) : 0;
                            return (
                              <tr key={r.proId || r.id} className="hover:bg-white/[0.01] transition-colors">
                                <td className="px-4 py-3 text-center">
                                  <span className={`inline-block font-extrabold ${
                                    idx === 0 ? 'text-gold' : idx === 1 ? 'text-slate-300' : idx === 2 ? 'text-amber-500' : 'text-gray-400'
                                  }`}>
                                    #{idx + 1}
                                  </span>
                                </td>
                                <td className="px-4 py-3 font-semibold text-white">{r.name}</td>
                                <td className="px-4 py-3 text-center text-gray-200">{r.premium}</td>
                                <td className="px-4 py-3 text-center text-gray-200">{r.smart}</td>
                                <td className="px-4 py-3 text-center text-gray-200">{r.standard}</td>
                                <td className="px-4 py-3 text-center font-extrabold text-gold text-sm">{r.total}</td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
                                      <div
                                        className="h-full bg-gradient-to-r from-gold to-gold-accent rounded-full"
                                        style={{ width: `${Math.min(Number(share) * 2, 100)}%` }}
                                      />
                                    </div>
                                    <span className="text-[11px] font-mono text-gray-400 min-w-[35px] text-right">{share}%</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          {filteredRecruiterRankings.length === 0 && (
                            <tr>
                              <td colSpan="7" className="text-center py-8 text-gray-500">
                                No recruiters found for the selected category filter.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ============ SUB-TAB 4: MONTHLY TIER BREAKDOWN TABLE ============ */}
              {reportSubTab === 'monthly' && (
                <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-gold" />
                        Chronological Monthly Tier Performance Audit
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">Month-by-month intake distribution and contributor engagement</p>
                    </div>
                    <span className="text-xs font-bold text-gold px-3 py-1 rounded-full bg-gold/10 border border-gold/20">
                      12 Reporting Cycles
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/5 text-gray-400 uppercase tracking-wider font-semibold">
                          <th className="px-4 py-3">Month</th>
                          <th className="px-4 py-3 text-center">Premium Tier</th>
                          <th className="px-4 py-3 text-center">Smart Tier</th>
                          <th className="px-4 py-3 text-center">Standard Tier</th>
                          <th className="px-4 py-3 text-center font-bold text-gold">Total Intake</th>
                          <th className="px-4 py-3 text-center">Active Recruiters</th>
                          <th className="px-4 py-3 text-right">% of FY Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredMonthlySummary.map((m) => {
                          const share = totalSponsorsCount > 0 ? ((m.total / totalSponsorsCount) * 100).toFixed(1) : '0';
                          const activeCount = m.activeCount || 0;
                          return (
                            <tr key={m.month} className="hover:bg-white/[0.01] transition-colors">
                              <td className="px-4 py-3 font-bold text-white flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-gold/40" />
                                {m.month}
                              </td>
                              <td className="px-4 py-3 text-center font-medium text-gray-200">{m.premium}</td>
                              <td className="px-4 py-3 text-center font-medium text-gray-200">{m.smart}</td>
                              <td className="px-4 py-3 text-center font-medium text-gray-200">{m.standard}</td>
                              <td className="px-4 py-3 text-center font-extrabold text-gold text-sm">{m.total}</td>
                              <td className="px-4 py-3 text-center">
                                <span className="px-2.5 py-0.5 rounded-full bg-white/5 border border-white/5 text-gray-300 font-bold">
                                  {activeCount} {reportCategoryFilter === 'office' ? 'office' : 'officer'}{activeCount !== 1 ? 's' : ''}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-mono font-bold text-gray-300">{share}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-white/10 font-bold text-white bg-white/[0.02]">
                          <td className="px-4 py-3 text-gold uppercase tracking-wider">Annual Total</td>
                          <td className="px-4 py-3 text-center text-gold font-bold">{filteredKPIs.premiumCount}</td>
                          <td className="px-4 py-3 text-center text-blue-400 font-bold">{filteredKPIs.smartCount}</td>
                          <td className="px-4 py-3 text-center text-emerald-400 font-bold">{filteredKPIs.standardCount}</td>
                          <td className="px-4 py-3 text-center text-gold text-base font-extrabold">{totalSponsorsCount}</td>
                          <td className="px-4 py-3 text-center text-purple-400 font-bold">{filteredKPIs.activeRecruitersCount} Active</td>
                          <td className="px-4 py-3 text-right text-gold font-mono font-bold">100.0%</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============ BULK IMPORT TAB ============ */}
      {activeTab === 'bulk' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="glass-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-white text-base mb-1">Download Import Template</h3>
              <p className="text-xs text-gray-400">Template columns: Month, Year, PRO Name, Premium, Smart, Standard, Notes</p>
            </div>
            <button onClick={downloadSampleTemplate} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-sm font-semibold text-gray-200 hover:bg-white/5 hover:border-white/20 transition-all cursor-pointer">
              <Download className="w-4 h-4" />
              Download Template
            </button>
          </div>

          {!file && (
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="glass-card p-10 border-2 border-dashed border-white/10 hover:border-white/20 rounded-2xl text-center cursor-pointer transition-all"
            >
              <Upload className="w-10 h-10 text-gray-500 mx-auto mb-3" />
              <p className="text-white font-semibold mb-1">Drop your CSV or Excel template here</p>
              <p className="text-gray-500 text-sm">or click to browse</p>
              <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileUpload} />
            </div>
          )}

          {bulkError && (
            <div className="glass-card p-4 border border-rose-500/20 bg-rose-500/5 text-rose-400 text-sm flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <span>{bulkError}</span>
            </div>
          )}

          {parsedRows.length > 0 && !importReport && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                {[
                  { label: 'Total Rows', val: parsedRows.length, color: '#6b7280' },
                  { label: 'Valid', val: parsedRows.filter(r => r.status === 'valid').length, color: '#34d399' },
                  { label: 'Duplicates', val: parsedRows.filter(r => r.status === 'duplicate').length, color: '#f59e0b' },
                  { label: 'Errors', val: parsedRows.filter(r => r.status === 'error').length, color: '#f87171' },
                ].map(b => (
                  <div key={b.label} className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-semibold"
                    style={{ borderColor: b.color + '44', color: b.color, background: b.color + '18' }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: b.color }} />
                    {b.val} {b.label}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSkipDuplicates(s => !s)}
                  className={`w-11 h-6 rounded-full transition-colors duration-200 flex items-center px-1 cursor-pointer ${skipDuplicates ? '' : 'bg-white/10'}`}
                  style={skipDuplicates ? { background: '#f5c518' } : {}}
                >
                  <span className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${skipDuplicates ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
                <span className="text-sm text-gray-300">Skip duplicate entries</span>
              </div>

              {/* Preview Table */}
              <div className="glass-card overflow-x-auto max-h-96">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-white/5 text-gray-400">
                      <th className="px-3 py-3">Row</th>
                      <th className="px-3 py-3">Period</th>
                      <th className="px-3 py-3">FY Scope</th>
                      <th className="px-3 py-3">Recruiter</th>
                      <th className="px-3 py-3 text-center">Premium</th>
                      <th className="px-3 py-3 text-center">Smart</th>
                      <th className="px-3 py-3 text-center">Standard</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Issues / Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map(row => (
                      <tr key={row.rowNum} className="border-b border-white/5 text-gray-300">
                        <td className="px-3 py-2 text-gray-500">#{row.rowNum}</td>
                        <td className="px-3 py-2">{row.month} {row.year}</td>
                        <td className="px-3 py-2 text-gray-400">{row.fyYear}</td>
                        <td className="px-3 py-2 font-medium text-white">{row.proName}</td>
                        <td className="px-3 py-2 text-center">{row.premiumCount}</td>
                        <td className="px-3 py-2 text-center">{row.smartCount}</td>
                        <td className="px-3 py-2 text-center">{row.standardCount}</td>
                        <td className="px-3 py-2">
                          {row.status === 'valid' && <span className="text-emerald-400 font-bold flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Valid</span>}
                          {row.status === 'duplicate' && <span className="text-amber-400 font-bold flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Duplicate</span>}
                          {row.status === 'error' && <span className="text-rose-400 font-bold flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Error</span>}
                        </td>
                        <td className="px-3 py-2 text-gray-500">
                          {row.errors.length > 0 ? (
                            <span className="text-rose-400">{row.errors.join(', ')}</span>
                          ) : row.status === 'duplicate' ? (
                            <span>Will be {skipDuplicates ? 'skipped' : 'overwritten'}</span>
                          ) : (
                            <span className="text-emerald-400">Ready</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <button
                  disabled={importing}
                  onClick={executeBulkImport}
                  className="px-5 py-2.5 bg-gradient-to-r from-gold to-gold-accent text-dark-bg font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 cursor-pointer"
                >
                  {importing ? 'Importing...' : 'Upload Valid Entries'}
                </button>
                <button
                  onClick={clearBulkState}
                  className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 font-bold rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Import Result Summary Report */}
          {importReport && (
            <div className="glass-card p-6 border border-white/10 space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" /> Import Complete
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Attempted', val: importReport.attempted, color: 'text-white' },
                  { label: 'Skipped', val: importReport.skipped, color: 'text-gray-400' },
                  { label: 'Inserted', val: importReport.inserted, color: 'text-emerald-400' },
                  { label: 'Updated', val: importReport.updated, color: 'text-amber-400' },
                ].map(r => (
                  <div key={r.label} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-center">
                    <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block">{r.label}</span>
                    <span className={`text-xl font-bold ${r.color}`}>{r.val}</span>
                  </div>
                ))}
              </div>

              {importReport.failed > 0 && (
                <div className="p-4 border border-rose-500/20 bg-rose-500/5 text-rose-400 text-xs rounded-xl space-y-2">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" /> Failed rows count: {importReport.failed}
                  </div>
                  <ul className="list-disc pl-5 space-y-1">
                    {importReport.errors.slice(0, 10).map((e, idx) => (
                      <li key={idx}>Row #{e.entry.rowNum || 'Unknown'}: {e.error}</li>
                    ))}
                    {importReport.errors.length > 10 && <li>...and {importReport.errors.length - 10} more errors.</li>}
                  </ul>
                </div>
              )}

              <button onClick={clearBulkState} className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 font-bold rounded-xl transition-all cursor-pointer">
                Clear & Back
              </button>
            </div>
          )}
        </div>
      )}

      {/* ============ DIALOG / MODAL FORM (SINGLE RECORD ENTRY) ============ */}
      <AnimatePresence>
        {formOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-gradient-to-b from-[#0a1128] to-[#040814] border border-white/10 rounded-2xl w-full max-w-lg shadow-xl shadow-black/50 overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-white/5 flex items-center justify-between">
                <h3 className="font-bold text-white text-lg">
                  {editingEntry ? 'Edit Sponsor Count Record' : 'Record Sponsor Counts'}
                </h3>
                <button onClick={() => setFormOpen(false)} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                {error && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                {successMsg && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs font-semibold flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span>{successMsg}</span>
                  </div>
                )}

                {/* Form Fields Row 1 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1">Month</label>
                    <select
                      value={formMonth}
                      onChange={e => setFormMonth(e.target.value)}
                      disabled={!!editingEntry}
                      className="w-full bg-[#0d1b2a]/60 border border-white/10 focus:border-gold rounded-xl px-3 py-2 text-sm text-white focus:outline-none disabled:opacity-50"
                    >
                      {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1">Year</label>
                    <input
                      type="number"
                      required
                      value={formYear}
                      disabled={!!editingEntry}
                      onChange={e => setFormYear(e.target.value)}
                      placeholder="e.g. 2025"
                      className="w-full bg-[#0d1b2a]/60 border border-white/10 focus:border-gold rounded-xl px-3 py-2 text-sm text-white focus:outline-none disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Form Field Row 2: Recruiter select */}
                <div>
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1">PRO / Office Recruiter</label>
                  <select
                    value={proId}
                    onChange={e => setProId(e.target.value)}
                    disabled={!!editingEntry}
                    className="w-full bg-[#0d1b2a]/60 border border-white/10 focus:border-gold rounded-xl px-3 py-2 text-sm text-white focus:outline-none disabled:opacity-50"
                  >
                    <option value="" disabled>Select Recruiter</option>
                    {activePros.map(p => (
                      <option key={p._id} value={p._id}>
                        {p.name} ({p.module?.name || 'PRO Collection'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Form Fields Row 3: Sponsor Counts */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1">Premium</label>
                    <input
                      type="number"
                      min="0"
                      value={premiumCount}
                      onChange={e => setPremiumCount(e.target.value)}
                      placeholder="0"
                      className="w-full bg-[#0d1b2a]/60 border border-white/10 focus:border-gold rounded-xl px-3 py-2 text-sm text-white focus:outline-none text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1">Smart</label>
                    <input
                      type="number"
                      min="0"
                      value={smartCount}
                      onChange={e => setSmartCount(e.target.value)}
                      placeholder="0"
                      className="w-full bg-[#0d1b2a]/60 border border-white/10 focus:border-gold rounded-xl px-3 py-2 text-sm text-white focus:outline-none text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1">Standard</label>
                    <input
                      type="number"
                      min="0"
                      value={standardCount}
                      onChange={e => setStandardCount(e.target.value)}
                      placeholder="0"
                      className="w-full bg-[#0d1b2a]/60 border border-white/10 focus:border-gold rounded-xl px-3 py-2 text-sm text-white focus:outline-none text-center font-bold"
                    />
                  </div>
                </div>

                {/* Form Field Row 4: Notes */}
                <div>
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1">Notes</label>
                  <textarea
                    rows="3"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Add notes..."
                    className="w-full bg-[#0d1b2a]/60 border border-white/10 focus:border-gold rounded-xl px-3 py-2 text-xs text-white focus:outline-none resize-none"
                  />
                </div>

                {/* Form Actions */}
                <div className="flex gap-4 pt-2 border-t border-white/5">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-gradient-to-r from-gold to-gold-accent text-dark-bg font-bold rounded-xl hover:shadow-lg transition-all cursor-pointer text-center text-sm"
                  >
                    {editingEntry ? 'Update Record' : 'Record Counts'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormOpen(false)}
                    className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 font-bold rounded-xl transition-all cursor-pointer text-center text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SponsorEntry;
