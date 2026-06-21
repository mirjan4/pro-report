import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import client from '../api/client';
import KPICard from '../components/KPICard';
import EChartWrapper from '../components/EChartWrapper';
import {
  HeartHandshake, Plus, Edit, Trash2, Check, X,
  Upload, Download, AlertTriangle, CheckCircle,
  TrendingUp, Users, Award, Sparkles, Layers,
  ChevronDown, BarChart3, LineChart, PieChart
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion';

const MONTHS = ['April','May','June','July','August','September','October','November','December','January','February','March'];

const SponsorEntry = () => {
  const { financialYears, selectedFY, pros, refreshMetadata } = useApp();
  const [sponsors, setSponsors] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [activeTab, setActiveTab] = useState('registry'); // 'registry', 'reports', 'bulk'
  const [expandedMonths, setExpandedMonths] = useState({});

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
      const fyParam = activeFY ? `?financialYear=${activeFY._id}` : '';

      // Get sponsor records
      const sponsorsRes = await client.get(`/api/sponsors${fyParam}`);
      if (sponsorsRes.data.success) {
        setSponsors(sponsorsRes.data.data);
      }

      // Get analytics reports
      const analyticsRes = await client.get(`/api/sponsors/analytics${fyParam}`);
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

  useEffect(() => {
    fetchData();
  }, [selectedFY, financialYears]);

  useEffect(() => {
    if (activePros.length > 0) setProId(activePros[0]._id);
  }, [pros]);

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
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet);

        if (rows.length === 0) {
          setBulkError('The uploaded file contains no data rows.');
          return;
        }

        const requiredHeaders = ['Month', 'Year', 'PRO Name', 'Premium', 'Smart', 'Standard'];
        const firstRow = rows[0];
        const missing = requiredHeaders.filter(h => !(h in firstRow));
        if (missing.length > 0) {
          setBulkError(`Missing required columns: ${missing.join(', ')}`);
          return;
        }

        const validated = rows.map((row, index) => {
          const errors = [];
          const rawPro = row['PRO Name']?.toString().trim();
          const rawMonth = row['Month']?.toString().trim();
          const rawYear = Number(row['Year']);
          const rawPremium = Number(row['Premium']);
          const rawSmart = Number(row['Smart']);
          const rawStandard = Number(row['Standard']);

          if (!rawPro) errors.push('PRO Name is required');
          if (!rawMonth || !MONTHS.includes(rawMonth)) errors.push(`Invalid Month name: "${rawMonth}"`);
          if (isNaN(rawYear) || rawYear < 2000 || rawYear > 2100) errors.push('Invalid Year number');
          if (isNaN(rawPremium) || rawPremium < 0) errors.push('Premium must be positive number');
          if (isNaN(rawSmart) || rawSmart < 0) errors.push('Smart must be positive number');
          if (isNaN(rawStandard) || rawStandard < 0) errors.push('Standard must be positive number');

          const resolvedPRO = pros.find(p => p.name.toLowerCase().trim() === rawPro?.toLowerCase());
          if (rawPro && !resolvedPRO) {
            errors.push(`No active PRO officer matches name "${rawPro}"`);
          }

          // Check duplicate in current local page state
          const isDuplicate = sponsors.some(c =>
            c.pro?._id?.toString() === resolvedPRO?._id?.toString() &&
            c.month === rawMonth &&
            c.year === rawYear
          );

          // Approximate FY
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

  // ECharts Configurations
  const monthlySummaryChartOption = analytics ? {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(13, 27, 42, 0.9)',
      borderColor: 'rgba(245, 197, 24, 0.3)',
      textStyle: { color: '#fff' }
    },
    legend: {
      textStyle: { color: '#9ca3af' },
      data: ['Premium', 'Smart', 'Standard', 'Total']
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
      { name: 'Premium', type: 'bar', stack: 'counts', data: analytics.monthlySummary.map(m => m.premium), itemStyle: { color: '#f5c518' } },
      { name: 'Smart', type: 'bar', stack: 'counts', data: analytics.monthlySummary.map(m => m.smart), itemStyle: { color: '#2563eb' } },
      { name: 'Standard', type: 'bar', stack: 'counts', data: analytics.monthlySummary.map(m => m.standard), itemStyle: { color: '#10b981' } },
      { name: 'Total', type: 'line', data: analytics.monthlySummary.map(m => m.total), itemStyle: { color: '#ffffff' }, lineStyle: { width: 2 } }
    ]
  } : {};

  const categoryShareChartOption = analytics ? {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
      backgroundColor: 'rgba(13, 27, 42, 0.9)',
      borderColor: 'rgba(245, 197, 24, 0.3)',
      textStyle: { color: '#fff' }
    },
    legend: { bottom: '5%', left: 'center', textStyle: { color: '#9ca3af' } },
    series: [
      {
        name: 'Sponsor Recruiters',
        type: 'pie',
        radius: ['50%', '70%'],
        padAngle: 3,
        itemStyle: { borderRadius: 10 },
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold', formatter: '{b}\n{c}', color: '#fff' } },
        data: [
          { value: analytics.byCategory.proSponsors, name: 'PRO Recruiters', itemStyle: { color: '#f5c518' } },
          { value: analytics.byCategory.officeSponsors, name: 'Office Recruiters', itemStyle: { color: '#2563eb' } }
        ]
      }
    ]
  } : {};

  const growthChartOption = analytics ? {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(13, 27, 42, 0.9)',
      borderColor: 'rgba(245, 197, 24, 0.3)',
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
              { offset: 0, color: 'rgba(245, 197, 24, 0.25)' },
              { offset: 1, color: 'transparent' }
            ]
          }
        },
        data: analytics.growthTrend.map(g => g.cumulative)
      }
    ]
  } : {};

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Sponsor <span className="gold-gradient-text">Tracking Portal</span>
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border border-gold/30 bg-gold/10 text-gold">
              <span className="w-1.5 h-1.5 rounded-full bg-gold" />
              Sponsors Mode
            </span>
            <p className="text-gray-400 text-sm">Monthly sponsor counts by PRO/Office recruiters — {selectedFY?.label}</p>
          </div>
        </div>
        {activeTab === 'registry' && (
          <button
            onClick={() => openAddForm(null)}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 glow-btn text-dark-bg bg-gradient-to-r from-gold to-gold-accent hover:shadow-lg cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Sponsor Entry</span>
          </button>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Sponsors" value={analytics?.kpis.totalSponsors || 0} icon={HeartHandshake} isCurrency={false} subtitle="All Categories" />
        <KPICard title="Premium Sponsors" value={analytics?.kpis.premiumCount || 0} icon={Award} isCurrency={false} subtitle="High Tier" />
        <KPICard title="Smart Sponsors" value={analytics?.kpis.smartCount || 0} icon={Sparkles} isCurrency={false} subtitle="Mid Tier" />
        <KPICard title="Standard Sponsors" value={analytics?.kpis.standardCount || 0} icon={Users} isCurrency={false} subtitle="Base Tier" />
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-2 border-b border-white/5 pb-2">
        {[
          { id: 'registry', label: 'Sponsor Registry', icon: Layers },
          { id: 'reports', label: 'Sponsor Reports', icon: BarChart3 },
          { id: 'bulk', label: 'Bulk Import', icon: Upload }
        ].map(t => (
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

                          <div className="flex items-center gap-4" onClick={e => e.stopPropagation()}>
                            <div className="text-right">
                              <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block">Month Total</span>
                              <span className="text-sm font-extrabold text-gold">
                                {monthTotal} Sponsors
                              </span>
                            </div>

                            <span className="w-px h-6 bg-white/10 hidden sm:block" />

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openAddForm(m)}
                                title={`Add entry for ${m}`}
                                className="p-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg transition-colors border border-white/5 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => toggleMonth(m)}
                                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                              >
                                <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? 'rotate-180' : 'rotate-0'}`} />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Expandable Table Area */}
                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2, ease: 'easeInOut' }}
                              className="overflow-hidden border-t border-white/5"
                            >
                              {monthEntries.length === 0 ? (
                                <div className="p-6 text-center text-sm text-gray-500 flex flex-col items-center gap-2">
                                  <span>No records registered for {m} yet.</span>
                                  <button onClick={() => openAddForm(m)} className="text-xs font-bold text-gold hover:underline flex items-center gap-1 mt-1 cursor-pointer">
                                    <Plus className="w-3 h-3" /> Add record
                                  </button>
                                </div>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs text-left border-collapse">
                                    <thead>
                                      <tr className="bg-white/[0.01] border-b border-white/5 text-gray-400 uppercase tracking-wider font-semibold">
                                        <th className="px-5 py-3 text-left">PRO/Office Recruiter</th>
                                        <th className="px-5 py-3 text-left">Category</th>
                                        <th className="px-5 py-3 text-center">Premium</th>
                                        <th className="px-5 py-3 text-center">Smart</th>
                                        <th className="px-5 py-3 text-center">Standard</th>
                                        <th className="px-5 py-3 text-center font-bold text-gold">Total</th>
                                        <th className="px-5 py-3 text-left">Notes</th>
                                        <th className="px-5 py-3 text-center">Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                      {monthEntries.map(c => (
                                        <tr key={c._id} className="hover:bg-white/[0.01] transition-colors text-gray-300">
                                          <td className="px-5 py-3.5 font-semibold text-white">{c.proName || c.pro?.name}</td>
                                          <td className="px-5 py-3.5 text-gray-400">
                                            {c.pro?.module?.name || 'PRO Collection'}
                                          </td>
                                          <td className="px-5 py-3.5 text-center font-medium">{c.premiumCount}</td>
                                          <td className="px-5 py-3.5 text-center font-medium">{c.smartCount}</td>
                                          <td className="px-5 py-3.5 text-center font-medium">{c.standardCount}</td>
                                          <td className="px-5 py-3.5 text-center font-bold text-gold">{c.totalSponsors}</td>
                                          <td className="px-5 py-3.5 text-gray-500 max-w-[200px] truncate" title={c.notes}>{c.notes || '—'}</td>
                                          <td className="px-5 py-3.5">
                                            <div className="flex justify-center gap-2">
                                              <button onClick={() => openEditForm(c)} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer">
                                                <Edit className="w-3.5 h-3.5" />
                                              </button>
                                              <button onClick={() => handleDelete(c._id)} className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer">
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                      {/* Month subtotal row */}
                                      <tr className="bg-white/[0.02] font-semibold text-white">
                                        <td className="px-5 py-3" colSpan="2">Monthly Totals</td>
                                        <td className="px-5 py-3 text-center text-gold">{premiumTotal}</td>
                                        <td className="px-5 py-3 text-center text-gold">{smartTotal}</td>
                                        <td className="px-5 py-3 text-center text-gold">{standardTotal}</td>
                                        <td className="px-5 py-3 text-center text-gold font-bold bg-gold/5">{monthTotal}</td>
                                        <td className="px-5 py-3" colSpan="2"></td>
                                      </tr>
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

      {/* ============ REPORTS TAB ============ */}
      {activeTab === 'reports' && (
        <div className="space-y-6 animate-fadeIn">
          {analyticsLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-gold" />
            </div>
          ) : !analytics ? (
            <div className="glass-card p-6 text-center text-gray-500 text-sm">No reporting data available.</div>
          ) : (
            <div className="space-y-6">
              {/* Reports Grid Section 1 */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 1. Monthly New Sponsors Summary */}
                <div className="lg:col-span-2 glass-card rounded-2xl p-6">
                  <h3 className="text-lg font-bold text-white flex items-center mb-4">
                    <BarChart3 className="w-5 h-5 mr-2 text-gold" />
                    Monthly New Sponsors Summary
                  </h3>
                  <div className="h-80">
                    <EChartWrapper option={monthlySummaryChartOption} />
                  </div>
                </div>

                {/* 2. Sponsors by PRO / Office */}
                <div className="glass-card rounded-2xl p-6">
                  <h3 className="text-lg font-bold text-white flex items-center mb-4">
                    <PieChart className="w-5 h-5 mr-2 text-gold" />
                    Sponsors by PRO / Office Recruiter Type
                  </h3>
                  <div className="h-80">
                    <EChartWrapper option={categoryShareChartOption} />
                  </div>
                </div>
              </div>

              {/* Reports Grid Section 2 */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 3. Top Sponsor Recruiters */}
                <div className="lg:col-span-2 glass-card rounded-2xl p-6 space-y-4">
                  <h3 className="text-lg font-bold text-white flex items-center">
                    <Award className="w-5 h-5 mr-2 text-gold" />
                    Top Sponsor Recruiters
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-white/[0.01] border-b border-white/5 text-gray-400 uppercase tracking-wider font-semibold">
                          <th className="px-4 py-2.5">Rank</th>
                          <th className="px-4 py-2.5">Recruiter</th>
                          <th className="px-4 py-2.5">Category</th>
                          <th className="px-4 py-2.5 text-center">Premium</th>
                          <th className="px-4 py-2.5 text-center">Smart</th>
                          <th className="px-4 py-2.5 text-center">Standard</th>
                          <th className="px-4 py-2.5 text-center font-bold text-gold">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {analytics.topRecruiters.map((r, idx) => (
                          <tr key={r.proId} className="hover:bg-white/[0.01] transition-colors">
                            <td className="px-4 py-3 text-sm font-bold text-gold">#{idx + 1}</td>
                            <td className="px-4 py-3 font-semibold text-white">{r.name}</td>
                            <td className="px-4 py-3 text-gray-400">{r.category}</td>
                            <td className="px-4 py-3 text-center">{r.premium}</td>
                            <td className="px-4 py-3 text-center">{r.smart}</td>
                            <td className="px-4 py-3 text-center">{r.standard}</td>
                            <td className="px-4 py-3 text-center font-bold text-gold">{r.total}</td>
                          </tr>
                        ))}
                        {analytics.topRecruiters.length === 0 && (
                          <tr>
                            <td colSpan="7" className="text-center py-6 text-gray-500">No recruiters registered with sponsors.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 4. Sponsor Growth Trend */}
                <div className="glass-card rounded-2xl p-6">
                  <h3 className="text-lg font-bold text-white flex items-center mb-4">
                    <LineChart className="w-5 h-5 mr-2 text-gold" />
                    Sponsor Growth Trend (Cumulative)
                  </h3>
                  <div className="h-80">
                    <EChartWrapper option={growthChartOption} />
                  </div>
                </div>
              </div>
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
