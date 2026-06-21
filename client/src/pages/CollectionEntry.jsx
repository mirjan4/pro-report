import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import client from '../api/client';
import {
  Layers, Plus, Edit, Trash2, Check, X,
  Upload, Download, AlertTriangle, CheckCircle,
  Trash, ChevronDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion';

const MONTHS = ['April','May','June','July','August','September','October','November','December','January','February','March'];

const CollectionEntry = () => {
  const { financialYears, selectedFY, pros, selectedModule, modules, collectionHeads, refreshedMetadata, refreshMetadata } = useApp();
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [activeTab, setActiveTab] = useState('registry');
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

  const [selectedCollectionIds, setSelectedCollectionIds] = useState([]);

  // Reset selections when module changes
  useEffect(() => {
    setSelectedCollectionIds([]);
  }, [selectedModule]);

  const handleToggleSelectCollection = (id) => {
    setSelectedCollectionIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectMonth = (monthName, monthEntries) => {
    const monthIds = monthEntries.map(c => c._id);
    const allSelected = monthIds.every(id => selectedCollectionIds.includes(id));
    
    if (allSelected) {
      setSelectedCollectionIds(prev => prev.filter(id => !monthIds.includes(id)));
    } else {
      setSelectedCollectionIds(prev => {
        const newSelections = [...prev];
        monthIds.forEach(id => {
          if (!newSelections.includes(id)) newSelections.push(id);
        });
        return newSelections;
      });
    }
  };

  const handleBulkDeleteCollections = async () => {
    if (selectedCollectionIds.length === 0) return;
    const count = selectedCollectionIds.length;
    if (!window.confirm(`Are you sure you want to delete the ${count} selected collection record(s)? This CANNOT be undone.`)) {
      return;
    }
    
    try {
      const res = await client.delete('/api/collections/bulk', { data: { ids: selectedCollectionIds } });
      if (res.data.success) {
        setCollections(collections.filter(c => !selectedCollectionIds.includes(c._id)));
        setSelectedCollectionIds([]);
        refreshMetadata();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to bulk delete collection records');
    }
  };

  // Form states (Single Entry)
  const [formMonth, setFormMonth] = useState('April');
  const [formYear, setFormYear] = useState(new Date().getFullYear());
  const [formModuleId, setFormModuleId] = useState('');
  const [proId, setProId] = useState('');
  const [amount, setAmount] = useState('');
  const [additionalCollectionsList, setAdditionalCollectionsList] = useState([]);
  const [newHead, setNewHead] = useState('');
  const [newHeadAmount, setNewHeadAmount] = useState('');
  const [showAdditional, setShowAdditional] = useState(false);
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

  // Module-filtered PROs
  const modulePros = selectedModule && selectedModule.code !== 'all'
    ? pros.filter(p => {
        const proModId = p.module?._id || p.module;
        return proModId?.toString() === selectedModule._id?.toString();
      })
    : pros;
  const activePros = modulePros.filter(p => p.status === 'active');

  const fetchCollections = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: 200 });
      if (selectedModule && selectedModule.code !== 'all') params.append('module', selectedModule._id);
      
      const activeFY = selectedFY || financialYears.find(fy => fy.isActive) || financialYears[0];
      if (activeFY) {
        params.append('financialYear', activeFY._id);
      }

      const res = await client.get(`/api/collections?${params}`);
      if (res.data.success) setCollections(res.data.data);
    } catch (err) {
      console.error('Failed to fetch collections', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCollections();
  }, [selectedModule, selectedFY, financialYears]);

  useEffect(() => {
    if (activePros.length > 0) setProId(activePros[0]._id);
  }, [selectedModule, pros]);

  const openAddForm = (defaultMonth) => {
    setEditingEntry(null);
    
    let mVal = defaultMonth || MONTHS[0];
    const activeFY = selectedFY || financialYears.find(fy => fy.isActive) || financialYears[0];
    const startYear = activeFY ? activeFY.startYear : new Date().getFullYear();
    const monthIdx = MONTHS.indexOf(mVal);
    const yVal = monthIdx >= 9 ? startYear + 1 : startYear;
    
    setFormMonth(mVal);
    setFormYear(yVal);
    
    const specificModules = modules.filter(m => m.code !== 'all');
    const defaultMod = selectedModule && selectedModule.code !== 'all' ? selectedModule._id : (specificModules[0]?._id || '');
    setFormModuleId(defaultMod);
    
    if (activePros.length > 0) setProId(activePros[0]._id);
    setAmount('');
    setAdditionalCollectionsList([]);
    setNewHead('');
    setNewHeadAmount('');
    setShowAdditional(false);
    setNotes('');
    setError('');
    setSuccessMsg('');
    setFormOpen(true);
  };

  const openEditForm = (entry) => {
    setEditingEntry(entry);
    
    setFormMonth(entry.month || 'April');
    setFormYear(entry.year || new Date().getFullYear());
    setFormModuleId(entry.module?._id || entry.module || '');
    setProId(entry.pro?._id || entry.pro);
    setAmount(entry.amount?.toString() || '0');
    let hasAdditional = false;
    if (entry.additionalCollections && entry.additionalCollections.length > 0) {
      setAdditionalCollectionsList(entry.additionalCollections.map(ac => ({ head: ac.head, amount: ac.amount?.toString() || '0' })));
      hasAdditional = true;
    } else if (entry.additionalAmount && entry.additionalAmount > 0) {
      setAdditionalCollectionsList([{ head: entry.additionalHead || 'Other', amount: entry.additionalAmount?.toString() || '0' }]);
      hasAdditional = true;
    } else {
      setAdditionalCollectionsList([]);
    }
    setNewHead('');
    setNewHeadAmount('');
    setShowAdditional(hasAdditional);
    setNotes(entry.notes || '');
    setError('');
    setSuccessMsg('');
    setFormOpen(true);
  };

  const handleAddAdditionalItem = (e) => {
    e.preventDefault();
    if (!newHead) {
      alert('Please select a head');
      return;
    }
    const val = Number(newHeadAmount) || 0;
    if (val <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    
    // Check if head already exists, if so merge amounts
    const existingIndex = additionalCollectionsList.findIndex(ac => ac.head === newHead);
    if (existingIndex > -1) {
      const updated = [...additionalCollectionsList];
      updated[existingIndex].amount = (Number(updated[existingIndex].amount) + val).toString();
      setAdditionalCollectionsList(updated);
    } else {
      setAdditionalCollectionsList(prev => [...prev, { head: newHead, amount: newHeadAmount.toString() }]);
    }
    
    setNewHead('');
    setNewHeadAmount('');
  };

  const handleRemoveAdditionalItem = (index) => {
    setAdditionalCollectionsList(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formMonth || !formYear || !proId) {
      setError('Please select month, year, and PRO');
      return;
    }
    if (!selectedModule) {
      setError('No module selected. Please select a module from the sidebar.');
      return;
    }
    
    const targetModuleId = selectedModule.code !== 'all' ? selectedModule._id : formModuleId;
    if (!targetModuleId) {
      setError('Please select a specific module.');
      return;
    }
    
    setError('');
    setSuccessMsg('');

    const cleanedCollectionsList = additionalCollectionsList
      .map(ac => ({ head: ac.head, amount: Number(ac.amount) || 0 }))
      .filter(ac => ac.amount > 0 && ac.head);

    const entryData = {
      module: targetModuleId,
      month: formMonth,
      year: Number(formYear),
      pro: proId,
      amount: Number(amount) || 0,
      additionalCollections: cleanedCollectionsList,
      notes
    };

    try {
      if (editingEntry) {
        const res = await client.put(`/api/collections/${editingEntry._id}`, entryData);
        if (res.data.success) {
          setSuccessMsg('Entry updated successfully!');
          fetchCollections();
        }
      } else {
        const res = await client.post('/api/collections', entryData);
        if (res.data.success) {
          setSuccessMsg('Entry created successfully!');
          fetchCollections();
        }
      }
      setTimeout(() => setFormOpen(false), 800);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit entry');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this collection record?')) return;
    try {
      const res = await client.delete(`/api/collections/${id}`);
      if (res.data.success) setCollections(collections.filter(c => c._id !== id));
    } catch (err) {
      alert('Failed to delete record');
    }
  };

  // --- Bulk Import ---
  const downloadSampleTemplate = () => {
    const headers = ['Month', 'Year', 'PRO Name', 'Amount', 'Notes'];
    const sampleRows = [
      ['April', '2025', 'Ahmed Al-Rashidi', '75000', ''],
      ['May', '2025', 'Fatima Malik', '60000', 'On time']
    ];
    const csvContent = [headers.join(','), ...sampleRows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Takaful_${selectedModule?.code || 'collection'}_template.csv`);
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
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(worksheet);
        if (rows.length === 0) { setBulkError('The uploaded file contains no data rows.'); return; }

        const requiredFields = ['Month', 'Year', 'PRO Name', 'Amount'];
        const keys = Object.keys(rows[0]);
        const missing = requiredFields.filter(f => !keys.includes(f));
        if (missing.length > 0) { setBulkError(`Missing required columns: ${missing.join(', ')}`); return; }

        const validated = rows.map((row, idx) => {
          const errors = [];
          
          let rawMonth = row['Month']?.toString().trim() || '';
          let parsedMonth = rawMonth;
          if (rawMonth) {
            parsedMonth = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1).toLowerCase();
          }
          if (!MONTHS.includes(parsedMonth)) {
            errors.push(`Invalid month: "${rawMonth}"`);
          }

          const rawYear = row['Year']?.toString().trim();
          const parsedYear = Number(rawYear);
          if (isNaN(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
            errors.push(`Invalid year: "${rawYear}"`);
          }

          const rawPro = row['PRO Name']?.toString().trim();
          const resolvedPRO = modulePros.find(p => p.name.toLowerCase() === rawPro?.toLowerCase());
          if (!resolvedPRO) errors.push(`PRO "${rawPro}" not found in this module`);
          else if (resolvedPRO.status !== 'active') errors.push(`PRO "${rawPro}" is inactive`);

          const isDuplicate = !errors.length && resolvedPRO
            ? collections.some(c => {
                const cProId = c.pro?._id || c.pro;
                return c.month === parsedMonth &&
                       c.year === parsedYear &&
                       cProId === resolvedPRO._id;
              })
            : false;

          const mIdx = MONTHS.indexOf(parsedMonth);
          const fyStartYearResolved = (mIdx >= 9 && mIdx <= 11) ? parsedYear - 1 : parsedYear;
          const fyEndYear = fyStartYearResolved + 1;
          const fyLabel = `${fyStartYearResolved}-${String(fyEndYear).substring(2)}`;

          return {
            rowNum: idx + 2,
            month: parsedMonth,
            year: parsedYear,
            fyYear: fyLabel,
            proName: rawPro,
            proId: resolvedPRO?._id,
            proModuleId: resolvedPRO ? (resolvedPRO.module?._id || resolvedPRO.module) : null,
            amount: Number(row['Amount']) || 0,
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
    if (!selectedModule) { setBulkError('No module selected. Select a module from the sidebar first.'); return; }
    const rowsToImport = parsedRows.filter(r => r.status !== 'error' && !(r.status === 'duplicate' && skipDuplicates));
    if (rowsToImport.length === 0) { alert('No valid rows to import.'); return; }

    setImporting(true);
    setBulkError('');
    const payload = rowsToImport.map(r => ({
      module: selectedModule.code !== 'all' ? selectedModule._id : r.proModuleId,
      month: r.month,
      year: Number(r.year),
      pro: r.proId,
      amount: r.amount,
      notes: r.notes
    }));

    try {
      const res = await client.post('/api/collections/bulk', { entries: payload, moduleId: selectedModule._id, skipDuplicates });
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
        fetchCollections();
        refreshMetadata();
      }
    } catch (err) {
      setBulkError(err.response?.data?.message || 'Bulk import server error');
    } finally {
      setImporting(false);
    }
  };

  const totalRows = parsedRows.length;
  const validRows = parsedRows.filter(r => r.status === 'valid').length;
  const errorRows = parsedRows.filter(r => r.status === 'error').length;
  const duplicateRows = parsedRows.filter(r => r.status === 'duplicate').length;

  const moduleColor = selectedModule?.color || '#d4af37';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Collection <span className="gold-gradient-text">Entry Portal</span>
          </h1>
          <div className="flex items-center gap-2 mt-1">
            {selectedModule && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border"
                style={{ color: moduleColor, borderColor: moduleColor + '44', background: moduleColor + '18' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: moduleColor }} />
                {selectedModule.name}
              </span>
            )}
            <p className="text-gray-400 text-sm">Submit and manage daily/monthly collection records</p>
          </div>
        </div>
        {activeTab === 'registry' && (
          <button
            onClick={() => openAddForm(null)}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 glow-btn text-dark-bg cursor-pointer"
            style={{ background: `linear-gradient(135deg, ${moduleColor}, ${moduleColor}cc)` }}
          >
            <Plus className="w-4 h-4" />
            <span>New Collection Entry</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-white/5 pb-2">
        {[{ id: 'registry', label: 'Entry Registry', icon: Layers }, { id: 'bulk', label: 'Bulk Import', icon: Upload }].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${
              activeTab === t.id ? 'text-dark-bg' : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
            style={activeTab === t.id ? { background: `linear-gradient(135deg, ${moduleColor}, ${moduleColor}cc)` } : {}}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* =========== REGISTRY TAB =========== */}
      {activeTab === 'registry' && (
        <div className="space-y-4">
          {!selectedModule && (
            <div className="glass-card p-4 border border-amber-500/20 bg-amber-500/5 text-amber-400 text-sm flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span>No module selected. Choose a module from the sidebar to view and manage entries.</span>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2" style={{ borderColor: moduleColor }} />
            </div>
          ) : (() => {
            const collectionsByMonth = MONTHS.reduce((acc, m) => {
              acc[m] = collections.filter(c => c.month === m);
              return acc;
            }, {});

            return (
              <div className="space-y-4">
                {/* Expand/Collapse All and Stats */}
                <div className="flex justify-between items-center bg-white/5 border border-white/10 p-4 rounded-2xl mb-4">
                  <div className="text-xs text-gray-400 font-medium">
                    Total: <span className="text-white font-bold">{collections.length} entries</span> across <span className="text-white font-bold">{MONTHS.filter(m => (collectionsByMonth[m] || []).length > 0).length} active months</span>
                  </div>
                  <div>
                    <button
                      onClick={handleToggleAllMonths}
                      className="px-4 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 text-xs font-bold rounded-xl transition-all cursor-pointer"
                    >
                      {allMonthsCollapsed ? 'Expand All' : 'Collapse All'}
                    </button>
                  </div>
                </div>

                {/* Monthly Stack */}
                <div className="space-y-4">
                  {MONTHS.map(m => {
                    const monthEntries = collectionsByMonth[m] || [];
                    const monthTotal = monthEntries.reduce((sum, c) => sum + (c.totalAmount || (c.amount || 0) + (c.additionalAmount || 0)), 0);
                    const isExpanded = !!expandedMonths[m];
                    const submissionCount = monthEntries.length;
                    const activeProsCount = activePros.length;

                    // Completion badge styling
                    let statusBadgeColor = 'bg-gray-500/10 text-gray-400 border border-white/5';
                    let statusText = '0 Entries';
                    if (submissionCount > 0) {
                      if (submissionCount >= activeProsCount && activeProsCount > 0) {
                        statusBadgeColor = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
                        statusText = 'Complete';
                      } else {
                        statusBadgeColor = 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
                        statusText = `${submissionCount}/${activeProsCount} Officers`;
                      }
                    }

                    return (
                      <div key={m} className={`glass-card rounded-2xl overflow-hidden border transition-all duration-300 ${isExpanded ? 'border-white/10 bg-white/[0.02]' : 'border-white/5 bg-transparent'}`}>
                        {/* Month Accordion Header */}
                        <div 
                          onClick={() => toggleMonth(m)}
                          className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors gap-4 select-none"
                        >
                          <div className="flex items-center gap-4">
                            <h3 className="text-lg font-bold text-white min-w-[100px]">{m}</h3>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${statusBadgeColor}`}>
                              {statusText}
                            </span>
                          </div>

                          <div className="flex items-center gap-4" onClick={e => e.stopPropagation()}>
                            <div className="text-right">
                              <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block">Total Collection</span>
                              <span className="text-sm font-extrabold" style={{ color: monthTotal > 0 ? moduleColor : '#6b7280' }}>
                                ₹{monthTotal.toLocaleString('en-IN')}
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
                                  <span>No entries recorded for {m} yet.</span>
                                  <button
                                    onClick={() => openAddForm(m)}
                                    className="text-xs font-bold text-gold hover:underline flex items-center gap-1 mt-1 cursor-pointer"
                                  >
                                    <Plus className="w-3 h-3" /> Add entry
                                  </button>
                                </div>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs text-left border-collapse">
                                    <thead>
                                      <tr className="bg-white/[0.01] border-b border-white/5 text-gray-400 uppercase tracking-wider font-semibold">
                                        <th className="px-5 py-3 text-left w-10">
                                          <input
                                            type="checkbox"
                                            checked={monthEntries.length > 0 && monthEntries.every(c => selectedCollectionIds.includes(c._id))}
                                            onChange={() => handleToggleSelectMonth(m, monthEntries)}
                                            className="w-3.5 h-3.5 rounded border-white/20 text-gold focus:ring-0 accent-gold cursor-pointer"
                                          />
                                        </th>
                                        <th className="px-5 py-3 text-left">Period</th>
                                        <th className="px-5 py-3 text-left">PRO Officer</th>
                                        <th className="px-5 py-3 text-right">Takaful (₹)</th>
                                        <th className="px-5 py-3 text-right">Additional (₹)</th>
                                        <th className="px-5 py-3 text-right">Total (₹)</th>
                                        <th className="px-5 py-3 text-left">Notes</th>
                                        <th className="px-5 py-3 text-center">Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                      {monthEntries.map(c => (
                                        <tr key={c._id} className={`hover:bg-white/[0.01] transition-colors text-gray-300 ${selectedCollectionIds.includes(c._id) ? 'bg-gold/[0.02]' : ''}`}>
                                          <td className="px-5 py-3.5">
                                            <input
                                              type="checkbox"
                                              checked={selectedCollectionIds.includes(c._id)}
                                              onChange={() => handleToggleSelectCollection(c._id)}
                                              className="w-3.5 h-3.5 rounded border-white/20 text-gold focus:ring-0 accent-gold cursor-pointer"
                                            />
                                          </td>
                                          <td className="px-5 py-3.5 text-gray-400">
                                            {c.month && c.year ? `${c.month} ${c.year}` : '—'}
                                          </td>
                                          <td className="px-5 py-3.5 font-semibold text-white">{c.proName || c.pro?.name}</td>
                                          <td className="px-5 py-3.5 text-right font-semibold text-gray-300">
                                            ₹{(c.amount || 0).toLocaleString('en-IN')}
                                          </td>
                                          <td className="px-5 py-3.5 text-right font-semibold text-gray-400">
                                            ₹{(c.additionalAmount || 0).toLocaleString('en-IN')}
                                            {c.additionalCollections && c.additionalCollections.length > 0 ? (
                                              <span className="block text-[10px] text-gray-500 font-medium">
                                                ({c.additionalCollections.map(ac => `${ac.head}: ₹${(ac.amount || 0).toLocaleString('en-IN')}`).join(', ')})
                                              </span>
                                            ) : c.additionalAmount > 0 && c.additionalHead ? (
                                              <span className="block text-[10px] text-gray-500 font-medium">({c.additionalHead})</span>
                                            ) : null}
                                          </td>
                                          <td className="px-5 py-3.5 text-right font-bold" style={{ color: moduleColor }}>
                                            ₹{(c.totalAmount || (c.amount || 0) + (c.additionalAmount || 0)).toLocaleString('en-IN')}
                                          </td>
                                          <td className="px-5 py-3.5 text-gray-500 max-w-[200px] truncate" title={c.notes}>{c.notes || '—'}</td>
                                          <td className="px-5 py-3.5">
                                            <div className="flex justify-center gap-2">
                                              <button
                                                onClick={() => openEditForm(c)}
                                                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                                              >
                                                <Edit className="w-3.5 h-3.5" />
                                              </button>
                                              <button
                                                onClick={() => handleDelete(c._id)}
                                                className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </div>
                                          </td>
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

                {/* Cumulative Grand Total Card */}
                <div className="glass-card rounded-2xl p-5 border border-white/10 bg-white/[0.02] flex items-center justify-between gap-4 mt-6">
                  <div>
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">Cumulative Summary</h4>
                    <p className="text-xs text-gray-500 mt-0.5 font-medium">Total across all months in selected financial year</p>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider flex gap-3 mb-1.5">
                      <span>Takaful: ₹{collections.reduce((s, c) => s + (c.amount || 0), 0).toLocaleString('en-IN')}</span>
                      <span>Additional: ₹{collections.reduce((s, c) => s + (c.additionalAmount || 0), 0).toLocaleString('en-IN')}</span>
                    </div>
                    <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block">Total Collected</span>
                    <span className="text-2xl font-extrabold" style={{ color: moduleColor }}>
                      ₹{collections.reduce((s, c) => s + (c.totalAmount || (c.amount || 0) + (c.additionalAmount || 0)), 0).toLocaleString('en-IN')}
                    </span>
                    <span className="text-xs text-gray-400 block mt-0.5">{collections.length} entries recorded</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* =========== BULK IMPORT TAB =========== */}
      {activeTab === 'bulk' && (
        <div className="space-y-6">
          {!selectedModule && (
            <div className="glass-card p-4 border border-amber-500/20 bg-amber-500/5 text-amber-400 text-sm flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span>Select a module from the sidebar before importing.</span>
            </div>
          )}

          {/* Template + Controls */}
          <div className="glass-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-white text-base mb-1">Download CSV Template</h3>
              <p className="text-xs text-gray-400">Template columns: Date, PRO Name, Amount, Notes</p>
            </div>
            <button onClick={downloadSampleTemplate}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-sm font-semibold text-gray-200 hover:bg-white/5 hover:border-white/20 transition-all cursor-pointer">
              <Download className="w-4 h-4" />
              Download Template
            </button>
          </div>

          {/* Drop Zone */}
          {!file && (
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="glass-card p-10 border-2 border-dashed border-white/10 hover:border-white/20 rounded-2xl text-center cursor-pointer transition-all"
            >
              <Upload className="w-10 h-10 text-gray-500 mx-auto mb-3" />
              <p className="text-white font-semibold mb-1">Drop your CSV or Excel file here</p>
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

          {/* Parsed Preview */}
          {parsedRows.length > 0 && (
            <div className="space-y-4">
              {/* Summary Badges */}
              <div className="flex flex-wrap gap-3">
                {[
                  { label: 'Total Rows', val: totalRows, color: '#6b7280' },
                  { label: 'Valid', val: validRows, color: '#34d399' },
                  { label: 'Duplicates', val: duplicateRows, color: '#f59e0b' },
                  { label: 'Errors', val: errorRows, color: '#f87171' },
                ].map(b => (
                  <div key={b.label} className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-semibold"
                    style={{ borderColor: b.color + '44', color: b.color, background: b.color + '18' }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: b.color }} />
                    {b.val} {b.label}
                  </div>
                ))}
              </div>

              {/* Skip Duplicates Toggle */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSkipDuplicates(s => !s)}
                  className={`w-11 h-6 rounded-full transition-colors duration-200 flex items-center px-1 cursor-pointer ${skipDuplicates ? '' : 'bg-white/10'}`}
                  style={skipDuplicates ? { background: moduleColor } : {}}
                >
                  <span className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${skipDuplicates ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
                <span className="text-sm text-gray-300">Skip duplicate entries</span>
              </div>

              {/* Preview Table */}
              <div className="glass-card overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/5 text-gray-400">
                      {['Row', 'Period', 'Estimated FY', 'PRO Name', 'Amount', 'Status', 'Issues'].map(h => (
                        <th key={h} className="text-left px-3 py-3 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map(row => (
                      <tr key={row.rowNum} className="border-b border-white/5">
                        <td className="px-3 py-2 text-gray-500">#{row.rowNum}</td>
                        <td className="px-3 py-2 text-gray-300">{row.month} {row.year}</td>
                        <td className="px-3 py-2 text-gray-400">{row.fyYear}</td>
                        <td className="px-3 py-2 text-white font-medium">{row.proName}</td>
                        <td className="px-3 py-2 font-bold" style={{ color: moduleColor }}>₹{(row.amount || 0).toLocaleString('en-IN')}</td>
                        <td className="px-3 py-2">
                          {row.status === 'valid' && <span className="text-emerald-400 font-bold flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Valid</span>}
                          {row.status === 'duplicate' && <span className="text-amber-400 font-bold flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Duplicate</span>}
                          {row.status === 'error' && <span className="text-rose-400 font-bold flex items-center gap-1"><X className="w-3.5 h-3.5" /> Error</span>}
                        </td>
                        <td className="px-3 py-2 text-gray-500">{row.errors?.join('; ') || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={executeBulkImport}
                  disabled={importing || validRows === 0}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-dark-bg disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                  style={{ background: `linear-gradient(135deg, ${moduleColor}, ${moduleColor}cc)` }}
                >
                  {importing ? <><div className="w-4 h-4 border-2 border-dark-bg/40 border-t-dark-bg rounded-full animate-spin" /> Importing...</> : <><Check className="w-4 h-4" /> Import {validRows + (skipDuplicates ? 0 : duplicateRows)} Rows</>}
                </button>
                <button onClick={clearBulkState} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-sm font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer">
                  <Trash className="w-4 h-4" /> Clear
                </button>
              </div>
            </div>
          )}

          {/* Import Report */}
          {importReport && (
            <div className="glass-card p-5 border border-emerald-500/20 bg-emerald-500/5 space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-base">
                <CheckCircle className="w-5 h-5" /> Import Complete
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                {[
                  { label: 'Total Rows', val: importReport.total, color: '#6b7280' },
                  { label: 'Inserted', val: importReport.inserted, color: '#34d399' },
                  { label: 'Updated', val: importReport.updated, color: '#60a5fa' },
                  { label: 'Skipped', val: importReport.skipped, color: '#f59e0b' },
                  { label: 'Failed', val: importReport.failed, color: '#f87171' },
                ].map(b => (
                  <div key={b.label} className="glass-card p-3 text-center">
                    <div className="text-2xl font-bold" style={{ color: b.color }}>{b.val}</div>
                    <div className="text-gray-400 text-xs mt-1">{b.label}</div>
                  </div>
                ))}
              </div>
              {importReport.errors?.length > 0 && (
                <div className="text-xs text-rose-400 space-y-1">
                  <p className="font-bold">Failed entries:</p>
                  {importReport.errors.slice(0, 5).map((e, i) => <p key={i}>{e.error}</p>)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =========== MODAL FORM =========== */}
      <AnimatePresence>
        {formOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setFormOpen(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="glass-card w-full max-w-lg p-6 space-y-5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">{editingEntry ? 'Edit' : 'New'} Collection Entry</h2>
                  {selectedModule && (
                    <span className="text-xs font-semibold mt-0.5 inline-block" style={{ color: moduleColor }}>
                      {selectedModule.name}
                    </span>
                  )}
                </div>
                <button onClick={() => setFormOpen(false)} className="p-2 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Module selection (only shown if "All Collections" is active) */}
                {selectedModule && selectedModule.code === 'all' && (
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Module</label>
                    <select
                      value={formModuleId}
                      onChange={e => setFormModuleId(e.target.value)}
                      className="w-full bg-[#0d1b2a] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-gold/50 cursor-pointer"
                    >
                      {modules.filter(m => m.code !== 'all').map(m => (
                        <option key={m._id} value={m._id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Month & Year Selection */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Month</label>
                    <select
                      value={formMonth}
                      onChange={e => setFormMonth(e.target.value)}
                      className="w-full bg-[#0d1b2a] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-gold/50 cursor-pointer"
                    >
                      {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Year</label>
                    <input
                      type="number"
                      value={formYear}
                      onChange={e => setFormYear(Number(e.target.value))}
                      className="w-full bg-[#0d1b2a] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-gold/50"
                      min="2000"
                      max="2100"
                    />
                  </div>
                </div>

                {/* PRO Officer */}
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">PRO Officer</label>
                  <select value={proId} onChange={e => setProId(e.target.value)}
                    className="w-full bg-[#0d1b2a] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-gold/50 cursor-pointer">
                    {activePros.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                  </select>
                  {activePros.length === 0 && <p className="text-xs text-amber-400 mt-1">No active PROs for this module.</p>}
                </div>

                {/* Takaful Collection Amount */}
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">
                    Takaful Collection (₹)
                  </label>
                  <input
                    type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)}
                    placeholder="Takaful amount"
                    className="w-full bg-[#0d1b2a] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-gold/50"
                  />
                </div>

                {/* Additional Collections Section */}
                {showAdditional ? (
                  <div className="space-y-3 border-t border-white/5 pt-3">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                        Additional Collections (Optional)
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAdditional(false);
                          setAdditionalCollectionsList([]);
                        }}
                        className="text-[10px] text-gray-500 hover:text-rose-400 hover:underline cursor-pointer"
                      >
                        Hide Section
                      </button>
                    </div>
                    
                    {/* List of Added Collections */}
                    {additionalCollectionsList.length > 0 && (
                      <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                        {additionalCollectionsList.map((item, index) => (
                          <div key={index} className="flex items-center justify-between bg-white/5 border border-white/5 px-3 py-2 rounded-xl text-xs">
                            <span className="font-semibold text-white">{item.head}</span>
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-gold">₹{Number(item.amount).toLocaleString('en-IN')}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveAdditionalItem(index)}
                                className="p-1 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {additionalCollectionsList.length === 0 && (
                      <p className="text-xs text-gray-500 italic pl-1">No additional collections added yet.</p>
                    )}

                    {/* Add New Additional Collection Form Row */}
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <select
                          value={newHead}
                          onChange={e => setNewHead(e.target.value)}
                          className="w-full bg-[#0d1b2a] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-gold/50 cursor-pointer h-[38px]"
                        >
                          <option value="">-- Select Head --</option>
                          {collectionHeads.filter(h => h.isActive).map(h => (
                            <option key={h._id} value={h.name}>{h.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="w-[120px]">
                        <input
                          type="number"
                          min="1"
                          placeholder="Amount"
                          value={newHeadAmount}
                          onChange={e => setNewHeadAmount(e.target.value)}
                          className="w-full bg-[#0d1b2a] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-gold/50 h-[38px]"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleAddAdditionalItem}
                        className="px-3 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 flex items-center justify-center transition-colors cursor-pointer h-[38px]"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAdditional(true)}
                    className="w-full py-2.5 px-4 rounded-xl border border-dashed border-white/10 hover:border-white/20 text-gray-400 hover:text-white transition-all text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer bg-white/[0.01]"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Additional Collection
                  </button>
                )}

                {/* Total Collected Live Preview */}
                <div className="bg-white/5 border border-white/10 p-3.5 rounded-xl flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Collected (Operational):</span>
                  <span className="text-base font-extrabold text-gold">
                    ₹{((Number(amount) || 0) + additionalCollectionsList.reduce((sum, c) => sum + (Number(c.amount) || 0), 0)).toLocaleString('en-IN')}
                  </span>
                </div>

                {/* Notes */}
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Notes (optional)</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                    className="w-full bg-[#0d1b2a] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-gold/50 resize-none"
                    placeholder="Any remarks..." />
                </div>

                {error && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
                  </div>
                )}
                {successMsg && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm flex items-center gap-2">
                    <Check className="w-4 h-4 flex-shrink-0" /> {successMsg}
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button type="submit" className="flex-1 py-2.5 rounded-xl font-bold text-sm text-dark-bg transition-all cursor-pointer"
                    style={{ background: `linear-gradient(135deg, ${moduleColor}, ${moduleColor}cc)` }}>
                    {editingEntry ? 'Update Entry' : 'Save Entry'}
                  </button>
                  <button type="button" onClick={() => setFormOpen(false)}
                    className="flex-1 py-2.5 rounded-xl font-bold text-sm border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer">
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Floating Bulk Actions Bar */}
      {selectedCollectionIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0c1224]/90 backdrop-blur-md border border-rose-500/30 rounded-2xl py-4 px-6 flex items-center justify-between gap-6 z-40 shadow-2xl shadow-rose-950/20 max-w-lg w-[90vw] animate-slideUp">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-white text-sm font-bold">{selectedCollectionIds.length} Record(s) Selected</p>
              <p className="text-gray-400 text-[11px] leading-tight mt-0.5">Delete selected collection entries.</p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setSelectedCollectionIds([])}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkDeleteCollections}
              className="px-4 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollectionEntry;
