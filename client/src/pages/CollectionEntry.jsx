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
const CALENDAR_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function getMonthCalendarYear(month, fyStartYear) {
  const idx = MONTHS.indexOf(month);
  return (idx >= 0 && idx <= 8) ? fyStartYear : fyStartYear + 1;
}

function isMonthEligible(month, calYear, joiningMonth, joiningYear) {
  if (!joiningMonth || !joiningYear) return true;
  const entryDate = new Date(Date.UTC(calYear, CALENDAR_MONTHS.indexOf(month), 1));
  const joiningDate = new Date(Date.UTC(joiningYear, CALENDAR_MONTHS.indexOf(joiningMonth), 1));
  return entryDate >= joiningDate;
}

/* ─── Shared micro-components ─── */

const SectionLabel = ({ children }) => (
  <p style={{
    fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
    textTransform: 'uppercase', color: 'var(--text-muted)',
    marginBottom: 6, marginTop: 0,
  }}>{children}</p>
);

const FieldBox = ({ children, style }) => (
  <div style={{
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 12,
    padding: '10px 14px',
    ...style,
  }}>{children}</div>
);

const SelectField = ({ value, onChange, disabled, children, style }) => (
  <select
    value={value}
    onChange={onChange}
    disabled={disabled}
    style={{
      width: '100%',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.09)',
      borderRadius: 10,
      padding: '9px 12px',
      fontSize: 13,
      color: disabled ? '#5a6070' : '#e2e8f0',
      outline: 'none',
      cursor: disabled ? 'not-allowed' : 'pointer',
      appearance: 'none',
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'right 10px center',
      paddingRight: 32,
      ...style,
    }}
  >{children}</select>
);

const NumberInput = ({ value, onChange, placeholder, min = 0, style }) => (
  <input
    type="number"
    min={min}
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    style={{
      width: '100%',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.09)',
      borderRadius: 10,
      padding: '9px 12px',
      fontSize: 13,
      color: '#e2e8f0',
      outline: 'none',
      boxSizing: 'border-box',
      ...style,
    }}
  />
);

const StatusPill = ({ text, variant }) => {
  const map = {
    complete: { bg: 'rgba(52,211,153,0.1)', color: '#34d399', border: 'rgba(52,211,153,0.2)' },
    partial:  { bg: 'rgba(251,191,36,0.1)',  color: '#fbbf24', border: 'rgba(251,191,36,0.2)' },
    empty:    { bg: 'rgba(248,113,113,0.1)', color: '#f87171', border: 'rgba(248,113,113,0.2)' },
    neutral:  { bg: 'rgba(107,114,128,0.1)', color: '#6b7280', border: 'rgba(107,114,128,0.15)' },
  };
  const s = map[variant] || map.neutral;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
      textTransform: 'uppercase',
      padding: '3px 9px', borderRadius: 99,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      whiteSpace: 'nowrap',
    }}>{text}</span>
  );
};

const AlertBanner = ({ icon: Icon, children, variant = 'warning' }) => {
  const map = {
    warning: { bg: 'rgba(251,191,36,0.06)', border: 'rgba(251,191,36,0.18)', color: '#fbbf24' },
    danger:  { bg: 'rgba(248,113,113,0.06)', border: 'rgba(248,113,113,0.18)', color: '#f87171' },
    success: { bg: 'rgba(52,211,153,0.06)', border: 'rgba(52,211,153,0.18)', color: '#34d399' },
  };
  const s = map[variant];
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '12px 16px', borderRadius: 12,
      background: s.bg, border: `1px solid ${s.border}`, color: s.color,
      fontSize: 13,
    }}>
      {Icon && <Icon size={15} style={{ marginTop: 1, flexShrink: 0 }} />}
      <span>{children}</span>
    </div>
  );
};

/* ─── Main Component ─── */

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

  useEffect(() => { setSelectedCollectionIds([]); }, [selectedModule]);

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
        monthIds.forEach(id => { if (!newSelections.includes(id)) newSelections.push(id); });
        return newSelections;
      });
    }
  };

  const handleBulkDeleteCollections = async () => {
    if (selectedCollectionIds.length === 0) return;
    const count = selectedCollectionIds.length;
    if (!window.confirm(`Are you sure you want to delete the ${count} selected collection record(s)? This CANNOT be undone.`)) return;
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

  const [formMonth, setFormMonth] = useState('April');
  const [formYear, setFormYear] = useState(new Date().getFullYear());
  const [formModuleId, setFormModuleId] = useState('');
  const [proId, setProId] = useState('');
  const [amount, setAmount] = useState('');
  const [expense, setExpense] = useState('');
  const [additionalCollectionsList, setAdditionalCollectionsList] = useState([]);
  const [newHead, setNewHead] = useState('');
  const [newHeadAmount, setNewHeadAmount] = useState('');
  const [showAdditional, setShowAdditional] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [file, setFile] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [bulkError, setBulkError] = useState('');
  const [importReport, setImportReport] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  const modulePros = selectedModule && selectedModule.code !== 'all'
    ? pros.filter(p => {
        const proModId = p.module?._id || p.module;
        return proModId?.toString() === selectedModule._id?.toString();
      })
    : pros;
  const activePros = modulePros.filter(p => p.status === 'active');

  const activeFormModuleId = (selectedModule && selectedModule.code !== 'all')
    ? selectedModule._id
    : formModuleId;

  const formPros = activeFormModuleId
    ? pros
        .filter(p => {
          const proModId = p.module?._id || p.module;
          return proModId?.toString() === activeFormModuleId.toString() && p.status === 'active';
        })
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];

  const fetchCollections = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: 2000 });
      if (selectedModule && selectedModule.code !== 'all') params.append('module', selectedModule._id);
      const activeFY =
        (selectedFY && selectedFY._id !== 'all' ? selectedFY : null) ||
        financialYears.find(fy => fy.isActive && fy._id !== 'all') ||
        financialYears.find(fy => fy._id !== 'all');
      if (activeFY) params.append('financialYear', activeFY._id);
      console.log('[CollectionEntry] fetchCollections →', `/api/collections?${params}`);
      const res = await client.get(`/api/collections?${params}`);
      if (res.data.success) setCollections(res.data.data);
    } catch (err) {
      console.error('[CollectionEntry] Failed to fetch collections', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCollections(); }, [selectedModule, selectedFY, financialYears]);

  useEffect(() => {
    if (formPros.length > 0) {
      if (!formPros.some(p => p._id === proId)) setProId(formPros[0]._id);
    } else {
      setProId('');
    }
  }, [formModuleId, selectedModule, pros]);

  const openAddForm = (defaultMonth) => {
    setEditingEntry(null);
    let mVal = defaultMonth || MONTHS[0];
    const activeFY = selectedFY || financialYears.find(fy => fy.isActive) || financialYears[0];
    const startYear = activeFY ? activeFY.startYear : new Date().getFullYear();
    const monthIdx = MONTHS.indexOf(mVal);
    const yVal = monthIdx >= 9 ? startYear + 1 : startYear;
    setFormMonth(mVal); setFormYear(yVal);
    setFormModuleId(selectedModule && selectedModule.code !== 'all' ? selectedModule._id : '');
    setAmount(''); setExpense('');
    setAdditionalCollectionsList([]); setNewHead(''); setNewHeadAmount('');
    setShowAdditional(false); setNotes(''); setError(''); setSuccessMsg('');
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
    setNewHead(''); setNewHeadAmount('');
    setShowAdditional(hasAdditional);
    setExpense(entry.expense?.toString() || '0');
    setNotes(entry.notes || '');
    setError(''); setSuccessMsg('');
    setFormOpen(true);
  };

  const handleAddAdditionalItem = (e) => {
    e.preventDefault();
    if (!newHead) { alert('Please select a head'); return; }
    const val = Number(newHeadAmount) || 0;
    if (val <= 0) { alert('Please enter a valid amount'); return; }
    const existingIndex = additionalCollectionsList.findIndex(ac => ac.head === newHead);
    if (existingIndex > -1) {
      const updated = [...additionalCollectionsList];
      updated[existingIndex].amount = (Number(updated[existingIndex].amount) + val).toString();
      setAdditionalCollectionsList(updated);
    } else {
      setAdditionalCollectionsList(prev => [...prev, { head: newHead, amount: newHeadAmount.toString() }]);
    }
    setNewHead(''); setNewHeadAmount('');
  };

  const handleRemoveAdditionalItem = (index) => {
    setAdditionalCollectionsList(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formMonth || !formYear || !proId) { setError('Please select month, year, and PRO'); return; }
    if (!selectedModule) { setError('No module selected. Please select a module from the sidebar.'); return; }
    const targetModuleId = selectedModule.code !== 'all' ? selectedModule._id : formModuleId;
    if (!targetModuleId) { setError('Please select a specific module.'); return; }
    setError(''); setSuccessMsg('');
    const selectedPro = pros.find(p => p._id === proId);
    if (selectedPro) {
      const eligible = isMonthEligible(formMonth, Number(formYear), selectedPro.joiningMonth, selectedPro.joiningYear);
      if (!eligible) { setError(`This PRO joined in ${selectedPro.joiningMonth} ${selectedPro.joiningYear}. Entries cannot be created for earlier months.`); return; }
    }
    const cleanedCollectionsList = additionalCollectionsList
      .map(ac => ({ head: ac.head, amount: Number(ac.amount) || 0 }))
      .filter(ac => ac.amount > 0 && ac.head);
    const entryData = {
      module: targetModuleId, month: formMonth, year: Number(formYear),
      pro: proId, amount: Number(amount) || 0,
      additionalCollections: cleanedCollectionsList,
      expense: Number(expense) || 0, notes,
    };
    try {
      if (editingEntry) {
        const res = await client.put(`/api/collections/${editingEntry._id}`, entryData);
        if (res.data.success) { setSuccessMsg('Entry updated successfully!'); fetchCollections(); }
      } else {
        const res = await client.post('/api/collections', entryData);
        if (res.data.success) { setSuccessMsg('Entry created successfully!'); fetchCollections(); }
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
    } catch (err) { alert('Failed to delete record'); }
  };

  const downloadSampleTemplate = () => {
    const headers = ['Month', 'Year', 'PRO Name', 'Amount', 'Notes'];
    const sampleRows = [
      ['April', '2025', 'Ahmed Al-Rashidi', '75000', ''],
      ['May', '2025', 'Fatima Malik', '60000', 'On time'],
    ];
    const csvContent = [headers.join(','), ...sampleRows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Takaful_${selectedModule?.code || 'collection'}_template.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;
    setFile(uploadedFile); setBulkError(''); setImportReport(null);
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
          if (rawMonth) parsedMonth = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1).toLowerCase();
          if (!MONTHS.includes(parsedMonth)) errors.push(`Invalid month: "${rawMonth}"`);
          const rawYear = row['Year']?.toString().trim();
          const parsedYear = Number(rawYear);
          if (isNaN(parsedYear) || parsedYear < 2000 || parsedYear > 2100) errors.push(`Invalid year: "${rawYear}"`);
          const rawPro = row['PRO Name']?.toString().trim();
          const resolvedPRO = modulePros.find(p => p.name.toLowerCase() === rawPro?.toLowerCase());
          if (!resolvedPRO) errors.push(`PRO "${rawPro}" not found in this module`);
          else if (resolvedPRO.status !== 'active') errors.push(`PRO "${rawPro}" is inactive`);
          const isDuplicate = !errors.length && resolvedPRO
            ? collections.some(c => { const cProId = c.pro?._id || c.pro; return c.month === parsedMonth && c.year === parsedYear && cProId === resolvedPRO._id; })
            : false;
          const mIdx = MONTHS.indexOf(parsedMonth);
          const fyStartYearResolved = (mIdx >= 9 && mIdx <= 11) ? parsedYear - 1 : parsedYear;
          const fyEndYear = fyStartYearResolved + 1;
          const fyLabel = `${fyStartYearResolved}-${String(fyEndYear).substring(2)}`;
          return {
            rowNum: idx + 2, month: parsedMonth, year: parsedYear, fyYear: fyLabel,
            proName: rawPro, proId: resolvedPRO?._id,
            proModuleId: resolvedPRO ? (resolvedPRO.module?._id || resolvedPRO.module) : null,
            amount: Number(row['Amount']) || 0,
            notes: row['Notes']?.toString().trim() || '',
            status: errors.length > 0 ? 'error' : isDuplicate ? 'duplicate' : 'valid',
            errors,
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
    setImporting(true); setBulkError('');
    const payload = rowsToImport.map(r => ({
      module: selectedModule.code !== 'all' ? selectedModule._id : r.proModuleId,
      month: r.month, year: Number(r.year), pro: r.proId, amount: r.amount, notes: r.notes,
    }));
    try {
      const res = await client.post('/api/collections/bulk', { entries: payload, moduleId: selectedModule._id, skipDuplicates });
      if (res.data.success) {
        const { results } = res.data;
        setImportReport({
          total: parsedRows.length, attempted: payload.length,
          skipped: parsedRows.length - payload.length,
          inserted: results.inserted, updated: results.updated,
          failed: results.failed, errors: results.errors,
        });
        fetchCollections(); refreshMetadata();
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

  /* ─── Styles ─── */
  const card = {
    background: 'rgba(255,255,255,0.025)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 16,
  };

  const glowBtn = {
    background: `linear-gradient(135deg, ${moduleColor}, ${moduleColor}bb)`,
    border: 'none',
    borderRadius: 10,
    padding: '9px 18px',
    fontSize: 13,
    fontWeight: 700,
    color: '#0d1b2a',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    transition: 'opacity 0.15s',
  };

  const ghostBtn = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: '9px 16px',
    fontSize: 13,
    fontWeight: 600,
    color: '#9ca3af',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    transition: 'all 0.15s',
  };

  /* ─── Render ─── */
  return (
    <div style={{ padding: '28px 24px', maxWidth: 1100, margin: '0 auto' }}>

      {/* ── Page Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.02em' }}>
            Collection{' '}
            <span style={{
              background: `linear-gradient(90deg, ${moduleColor}, ${moduleColor}aa)`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>Entry Portal</span>
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
            {selectedModule && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
                color: moduleColor, border: `1px solid ${moduleColor}33`,
                background: `${moduleColor}12`, letterSpacing: '0.04em',
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: moduleColor, display: 'inline-block' }} />
                {selectedModule.name}
              </span>
            )}
            <span style={{ fontSize: 13, color: '#6b7280' }}>Monthly collection records</span>
          </div>
        </div>
        {activeTab === 'registry' && (
          <button onClick={() => openAddForm(null)} style={glowBtn}>
            <Plus size={14} /> New Entry
          </button>
        )}
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, padding: '4px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, width: 'fit-content' }}>
        {[{ id: 'registry', label: 'Entry Registry', Icon: Layers }, { id: 'bulk', label: 'Bulk Import', Icon: Upload }].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '8px 16px', borderRadius: 9, border: 'none',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.18s',
              ...(activeTab === t.id
                ? { background: `linear-gradient(135deg, ${moduleColor}, ${moduleColor}cc)`, color: '#0d1b2a' }
                : { background: 'transparent', color: '#6b7280' }),
            }}
          >
            <t.Icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════ REGISTRY TAB ══════════════════════════════════════ */}
      {activeTab === 'registry' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!selectedModule && (
            <AlertBanner icon={AlertTriangle} variant="warning">
              No module selected. Choose a module from the sidebar to view and manage entries.
            </AlertBanner>
          )}

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                border: `2.5px solid ${moduleColor}33`,
                borderTopColor: moduleColor,
                animation: 'spin 0.9s linear infinite',
              }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : (() => {
            const collectionsByMonth = MONTHS.reduce((acc, m) => {
              acc[m] = collections.filter(c => c.month === m);
              return acc;
            }, {});

            const currentFY = selectedFY || financialYears.find(fy => fy.isActive) || financialYears[0];
            const fyStartYear = currentFY ? currentFY.startYear : new Date().getFullYear();

            let totalEligibleMonths = 0;
            activePros.forEach(p => {
              MONTHS.forEach(m => {
                const calYear = getMonthCalendarYear(m, fyStartYear);
                if (isMonthEligible(m, calYear, p.joiningMonth, p.joiningYear)) totalEligibleMonths++;
              });
            });
            if (totalEligibleMonths === 0) totalEligibleMonths = activePros.length * 12;
            const completionPercentage = totalEligibleMonths > 0
              ? Math.round((collections.length / totalEligibleMonths) * 100) : 0;

            return (
              <>
                {/* Stats bar */}
                <div style={{
                  ...card,
                  padding: '14px 20px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
                }}>
                  <div style={{ display: 'flex', gap: 28 }}>
                    {[
                      { label: 'Total Entries', val: collections.length },
                      { label: 'Active Months', val: MONTHS.filter(m => (collectionsByMonth[m] || []).length > 0).length },
                      { label: 'Expected', val: totalEligibleMonths },
                    ].map(s => (
                      <div key={s.label}>
                        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 2 }}>{s.label}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9' }}>{s.val}</div>
                      </div>
                    ))}
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 2 }}>Completion</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: moduleColor }}>{completionPercentage}%</div>
                    </div>
                  </div>
                  <button
                    onClick={handleToggleAllMonths}
                    style={{ ...ghostBtn, fontSize: 12, padding: '7px 14px' }}
                  >
                    {allMonthsCollapsed ? 'Expand all' : 'Collapse all'}
                  </button>
                </div>

                {/* Monthly accordion stack */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {MONTHS.map(m => {
                    const monthEntries = collectionsByMonth[m] || [];
                    const monthTotal = monthEntries.reduce((sum, c) => sum + (c.totalAmount || (c.amount || 0) + (c.additionalAmount || 0)), 0);
                    const isExpanded = !!expandedMonths[m];
                    const submissionCount = monthEntries.length;
                    const calYear = getMonthCalendarYear(m, fyStartYear);
                    const eligibleProsForMonth = activePros.filter(p => isMonthEligible(m, calYear, p.joiningMonth, p.joiningYear));
                    const eligibleProsCount = eligibleProsForMonth.length;

                    let pillVariant = 'neutral', pillText = '0 entries';
                    if (eligibleProsCount === 0) { pillVariant = 'neutral'; pillText = 'Not joined yet'; }
                    else if (submissionCount >= eligibleProsCount) { pillVariant = 'complete'; pillText = 'Complete'; }
                    else if (submissionCount > 0) { pillVariant = 'partial'; pillText = `${submissionCount}/${eligibleProsCount} officers`; }
                    else { pillVariant = 'empty'; pillText = `0/${eligibleProsCount} officers`; }

                    return (
                      <div key={m} style={{
                        ...card,
                        border: `1px solid ${isExpanded ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)'}`,
                        transition: 'border-color 0.2s',
                        overflow: 'hidden',
                      }}>
                        {/* Month header */}
                        <div
                          onClick={() => toggleMonth(m)}
                          style={{
                            padding: '14px 20px',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            cursor: 'pointer', userSelect: 'none', gap: 12,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', minWidth: 90 }}>{m}</span>
                            <StatusPill text={pillText} variant={pillVariant} />
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }} onClick={e => e.stopPropagation()}>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Collection</div>
                              <div style={{ fontSize: 15, fontWeight: 800, color: monthTotal > 0 ? moduleColor : '#4b5563' }}>
                                ₹{monthTotal.toLocaleString('en-IN')}
                              </div>
                            </div>
                            <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.07)' }} />
                            <div style={{ display: 'flex', gap: 6 }}>
                              {eligibleProsCount > 0 && (
                                <button
                                  onClick={() => openAddForm(m)}
                                  title={`Add entry for ${m}`}
                                  style={{
                                    width: 30, height: 30, borderRadius: 8,
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    color: '#9ca3af', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'all 0.15s',
                                  }}
                                >
                                  <Plus size={13} />
                                </button>
                              )}
                              <button
                                onClick={() => toggleMonth(m)}
                                style={{
                                  width: 30, height: 30, borderRadius: 8,
                                  background: 'transparent', border: 'none',
                                  color: '#6b7280', cursor: 'pointer',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  transition: 'color 0.15s',
                                }}
                              >
                                <ChevronDown size={15} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s' }} />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Expandable area */}
                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2, ease: 'easeInOut' }}
                              style={{ overflow: 'hidden', borderTop: '1px solid rgba(255,255,255,0.05)' }}
                            >
                              {monthEntries.length === 0 ? (
                                <div style={{ padding: '28px 20px', textAlign: 'center' }}>
                                  <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
                                    {eligibleProsCount === 0 ? 'No officers have joined yet.' : `No entries recorded for ${m}.`}
                                  </div>
                                  {eligibleProsCount > 0 && (
                                    <button
                                      onClick={() => openAddForm(m)}
                                      style={{ background: 'none', border: 'none', color: moduleColor, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                    >
                                      <Plus size={12} /> Add entry
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <div style={{ overflowX: 'auto' }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                    <thead>
                                      <tr style={{ background: 'rgba(255,255,255,0.015)' }}>
                                        {['', 'Period', 'PRO Officer', 'Takaful (₹)', 'Additional (₹)', 'Expense (₹)', 'Total (₹)', 'Notes', ''].map((h, i) => (
                                          <th key={i} style={{
                                            padding: '10px 16px', textAlign: i === 0 ? 'center' : i >= 3 && i <= 6 ? 'right' : i === 8 ? 'center' : 'left',
                                            color: '#6b7280', fontWeight: 700, fontSize: 10,
                                            letterSpacing: '0.07em', textTransform: 'uppercase',
                                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                                            whiteSpace: 'nowrap',
                                          }}>{h}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {monthEntries.map((c, idx) => (
                                        <tr key={c._id} style={{
                                          borderBottom: idx < monthEntries.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                          background: selectedCollectionIds.includes(c._id) ? `${moduleColor}08` : 'transparent',
                                          transition: 'background 0.15s',
                                        }}>
                                          <td style={{ padding: '11px 16px', textAlign: 'center' }}>
                                            <input
                                              type="checkbox"
                                              checked={selectedCollectionIds.includes(c._id)}
                                              onChange={() => handleToggleSelectCollection(c._id)}
                                              style={{ width: 13, height: 13, cursor: 'pointer', accentColor: moduleColor }}
                                            />
                                          </td>
                                          <td style={{ padding: '11px 16px', color: '#6b7280' }}>
                                            {c.month && c.year ? `${c.month} ${c.year}` : '—'}
                                          </td>
                                          <td style={{ padding: '11px 16px', fontWeight: 600, color: '#e2e8f0' }}>{c.proName || c.pro?.name}</td>
                                          <td style={{ padding: '11px 16px', textAlign: 'right', color: '#d1d5db' }}>₹{(c.amount || 0).toLocaleString('en-IN')}</td>
                                          <td style={{ padding: '11px 16px', textAlign: 'right', color: '#9ca3af' }}>
                                            ₹{(c.additionalAmount || 0).toLocaleString('en-IN')}
                                            {c.additionalCollections?.length > 0 && (
                                              <span style={{ display: 'block', fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                                                {c.additionalCollections.map(ac => `${ac.head}: ₹${(ac.amount||0).toLocaleString('en-IN')}`).join(', ')}
                                              </span>
                                            )}
                                          </td>
                                          <td style={{ padding: '11px 16px', textAlign: 'right', color: '#f87171' }}>
                                            ₹{(c.expense || 0).toLocaleString('en-IN')}
                                          </td>
                                          <td style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 800, color: moduleColor }}>
                                            ₹{(c.totalAmount || (c.amount||0) + (c.additionalAmount||0)).toLocaleString('en-IN')}
                                          </td>
                                          <td style={{ padding: '11px 16px', color: '#6b7280', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.notes}>{c.notes || '—'}</td>
                                          <td style={{ padding: '11px 16px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                                              <button
                                                onClick={() => openEditForm(c)}
                                                style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                                              ><Edit size={12} /></button>
                                              <button
                                                onClick={() => handleDelete(c._id)}
                                                style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                                              ><Trash2 size={12} /></button>
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>

                                  {/* Month sub-footer with checkbox select-all */}
                                  <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <input
                                      type="checkbox"
                                      checked={monthEntries.length > 0 && monthEntries.every(c => selectedCollectionIds.includes(c._id))}
                                      onChange={() => handleToggleSelectMonth(m, monthEntries)}
                                      style={{ width: 13, height: 13, cursor: 'pointer', accentColor: moduleColor }}
                                    />
                                    <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Select all in {m}</span>
                                  </div>
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>

                {/* Grand total card */}
                <div style={{
                  ...card,
                  border: '1px solid rgba(255,255,255,0.08)',
                  padding: '20px 24px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16,
                  marginTop: 8,
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>Cumulative summary</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>All months in this financial year</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 20, justifyContent: 'flex-end', marginBottom: 6 }}>
                      {[
                        { label: 'Takaful', val: collections.reduce((s, c) => s + (c.amount||0), 0) },
                        { label: 'Additional', val: collections.reduce((s, c) => s + (c.additionalAmount||0), 0) },
                        { label: 'Expense', val: collections.reduce((s, c) => s + (c.expense||0), 0) },
                      ].map(x => (
                        <div key={x.label} style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>
                          {x.label}: <span style={{ color: '#d1d5db' }}>₹{x.val.toLocaleString('en-IN')}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280' }}>Total collected</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: moduleColor, letterSpacing: '-0.02em' }}>
                      ₹{collections.reduce((s, c) => s + (c.totalAmount || (c.amount||0) + (c.additionalAmount||0)), 0).toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{collections.length} entries recorded</div>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* ══════════════════════════════════════ BULK IMPORT TAB ══════════════════════════════════════ */}
      {activeTab === 'bulk' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {!selectedModule && (
            <AlertBanner icon={AlertTriangle} variant="warning">
              Select a module from the sidebar before importing.
            </AlertBanner>
          )}

          {/* Template download */}
          <div style={{ ...card, padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>Download CSV template</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Columns: Month, Year, PRO Name, Amount, Notes</div>
            </div>
            <button onClick={downloadSampleTemplate} style={ghostBtn}>
              <Download size={13} /> Download template
            </button>
          </div>

          {/* Drop zone */}
          {!file && (
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                ...card,
                border: '1.5px dashed rgba(255,255,255,0.1)',
                padding: '52px 24px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'border-color 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 14px',
              }}>
                <Upload size={20} color="#6b7280" />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 5 }}>Drop your file here</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>CSV or Excel (.csv, .xlsx, .xls)</div>
              <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={handleFileUpload} />
            </div>
          )}

          {bulkError && <AlertBanner icon={AlertTriangle} variant="danger">{bulkError}</AlertBanner>}

          {parsedRows.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Summary badges */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {[
                  { label: 'Total rows', val: totalRows, color: '#6b7280' },
                  { label: 'Valid', val: validRows, color: '#34d399' },
                  { label: 'Duplicates', val: duplicateRows, color: '#fbbf24' },
                  { label: 'Errors', val: errorRows, color: '#f87171' },
                ].map(b => (
                  <div key={b.label} style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '6px 12px', borderRadius: 8,
                    border: `1px solid ${b.color}33`,
                    background: `${b.color}12`,
                    fontSize: 12, fontWeight: 700, color: b.color,
                  }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: b.color, display: 'inline-block' }} />
                    {b.val} {b.label}
                  </div>
                ))}
              </div>

              {/* Skip duplicates toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={() => setSkipDuplicates(s => !s)}
                  style={{
                    width: 40, height: 22, borderRadius: 99, border: 'none',
                    background: skipDuplicates ? moduleColor : 'rgba(255,255,255,0.1)',
                    cursor: 'pointer', transition: 'background 0.2s',
                    display: 'flex', alignItems: 'center',
                    padding: '0 3px',
                  }}
                >
                  <span style={{
                    width: 16, height: 16, borderRadius: '50%', background: '#fff',
                    transition: 'transform 0.2s',
                    transform: skipDuplicates ? 'translateX(18px)' : 'translateX(0)',
                    display: 'block',
                  }} />
                </button>
                <span style={{ fontSize: 13, color: '#d1d5db' }}>Skip duplicate entries</span>
              </div>

              {/* Preview table */}
              <div style={{ ...card, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      {['Row', 'Period', 'Est. FY', 'PRO Name', 'Amount', 'Status', 'Issues'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#6b7280', fontWeight: 700, fontSize: 10, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map(row => (
                      <tr key={row.rowNum} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '9px 14px', color: '#6b7280' }}>#{row.rowNum}</td>
                        <td style={{ padding: '9px 14px', color: '#d1d5db' }}>{row.month} {row.year}</td>
                        <td style={{ padding: '9px 14px', color: '#9ca3af' }}>{row.fyYear}</td>
                        <td style={{ padding: '9px 14px', color: '#e2e8f0', fontWeight: 600 }}>{row.proName}</td>
                        <td style={{ padding: '9px 14px', fontWeight: 700, color: moduleColor }}>₹{(row.amount||0).toLocaleString('en-IN')}</td>
                        <td style={{ padding: '9px 14px' }}>
                          {row.status === 'valid' && <span style={{ color: '#34d399', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle size={12} /> Valid</span>}
                          {row.status === 'duplicate' && <span style={{ color: '#fbbf24', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={12} /> Duplicate</span>}
                          {row.status === 'error' && <span style={{ color: '#f87171', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}><X size={12} /> Error</span>}
                        </td>
                        <td style={{ padding: '9px 14px', color: '#6b7280' }}>{row.errors?.join('; ') || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={executeBulkImport}
                  disabled={importing || validRows === 0}
                  style={{ ...glowBtn, opacity: (importing || validRows === 0) ? 0.5 : 1, cursor: (importing || validRows === 0) ? 'not-allowed' : 'pointer' }}
                >
                  {importing
                    ? <><div style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid #0d1b2a55', borderTopColor: '#0d1b2a', animation: 'spin 0.8s linear infinite' }} /> Importing…</>
                    : <><Check size={13} /> Import {validRows + (skipDuplicates ? 0 : duplicateRows)} rows</>}
                </button>
                <button onClick={clearBulkState} style={ghostBtn}>
                  <Trash size={13} /> Clear
                </button>
              </div>
            </div>
          )}

          {importReport && (
            <div style={{ ...card, border: '1px solid rgba(52,211,153,0.18)', background: 'rgba(52,211,153,0.05)', padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#34d399', fontWeight: 700, fontSize: 14, marginBottom: 16 }}>
                <CheckCircle size={16} /> Import complete
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10 }}>
                {[
                  { label: 'Total rows', val: importReport.total, color: '#6b7280' },
                  { label: 'Inserted', val: importReport.inserted, color: '#34d399' },
                  { label: 'Updated', val: importReport.updated, color: '#60a5fa' },
                  { label: 'Skipped', val: importReport.skipped, color: '#fbbf24' },
                  { label: 'Failed', val: importReport.failed, color: '#f87171' },
                ].map(b => (
                  <div key={b.label} style={{ ...card, padding: '14px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: b.color }}>{b.val}</div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>{b.label}</div>
                  </div>
                ))}
              </div>
              {importReport.errors?.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#f87171', marginBottom: 6 }}>Failed entries:</div>
                  {importReport.errors.slice(0, 5).map((e, i) => (
                    <div key={i} style={{ fontSize: 12, color: '#f87171', marginBottom: 2 }}>{e.error}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════ MODAL FORM ══════════════════════════════════════ */}
      <AnimatePresence>
        {formOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.65)',
              backdropFilter: 'blur(6px)',
              zIndex: 50,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 16,
            }}
            onClick={e => { if (e.target === e.currentTarget) setFormOpen(false); }}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 16 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              style={{
                background: '#0d1b2a',
                border: '1px solid rgba(255,255,255,0.09)',
                borderRadius: 20,
                width: '100%',
                maxWidth: 620,
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
              }}
            >
              {/* Modal header */}
              <div style={{
                padding: '20px 24px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexShrink: 0,
              }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#f1f5f9' }}>
                    {editingEntry ? 'Edit entry' : 'New collection entry'}
                  </div>
                  {selectedModule && (
                    <div style={{ fontSize: 11, color: moduleColor, fontWeight: 600, marginTop: 2 }}>{selectedModule.name}</div>
                  )}
                </div>
                <button
                  onClick={() => setFormOpen(false)}
                  style={{
                    width: 32, height: 32, borderRadius: 9,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#9ca3af', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                ><X size={14} /></button>
              </div>

              <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Scrollable body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>

                  {/* Module (all-mode only) */}
                  {selectedModule && selectedModule.code === 'all' && (
                    <div>
                      <SectionLabel>Module</SectionLabel>
                      <SelectField value={formModuleId} onChange={e => setFormModuleId(e.target.value)}>
                        <option value="">Select module</option>
                        {modules.filter(m => m.code !== 'all').map(m => (
                          <option key={m._id} value={m._id}>{m.name}</option>
                        ))}
                      </SelectField>
                    </div>
                  )}

                  {/* Month & Year */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <SectionLabel>Month</SectionLabel>
                      <SelectField value={formMonth} onChange={e => setFormMonth(e.target.value)}>
                        {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                      </SelectField>
                    </div>
                    <div>
                      <SectionLabel>Year</SectionLabel>
                      <NumberInput value={formYear} onChange={e => setFormYear(Number(e.target.value))} min={2000} />
                    </div>
                  </div>

                  {/* PRO Officer */}
                  <div>
                    <SectionLabel>PRO Officer</SectionLabel>
                    <SelectField
                      value={proId}
                      onChange={e => setProId(e.target.value)}
                      disabled={!activeFormModuleId || formPros.length === 0}
                    >
                      {!activeFormModuleId && <option value="">Select a module first</option>}
                      {activeFormModuleId && formPros.length === 0 && <option value="">No officers available</option>}
                      {activeFormModuleId && formPros.map(p => (
                        <option key={p._id} value={p._id}>{p.name}</option>
                      ))}
                    </SelectField>
                    {!activeFormModuleId
                      ? <p style={{ fontSize: 11, color: '#6b7280', marginTop: 5, marginBottom: 0 }}>Please select a module first.</p>
                      : formPros.length === 0
                        ? <p style={{ fontSize: 11, color: '#f87171', marginTop: 5, marginBottom: 0, fontWeight: 600 }}>No officers available for this module.</p>
                        : null}
                  </div>

                  {/* Takaful & Expense */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <SectionLabel>Takaful collection (₹)</SectionLabel>
                      <NumberInput value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" />
                    </div>
                    <div>
                      <SectionLabel>Expense (₹)</SectionLabel>
                      <NumberInput value={expense} onChange={e => setExpense(e.target.value)} placeholder="0" />
                    </div>
                  </div>

                  {/* Additional Collections */}
                  {showAdditional ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <SectionLabel>Additional collections</SectionLabel>
                        <button
                          type="button"
                          onClick={() => { setShowAdditional(false); setAdditionalCollectionsList([]); }}
                          style={{ background: 'none', border: 'none', fontSize: 11, color: '#6b7280', cursor: 'pointer', padding: 0, fontWeight: 600 }}
                        >Hide section</button>
                      </div>
                      {additionalCollectionsList.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                          {additionalCollectionsList.map((item, index) => (
                            <div key={index} style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '9px 12px', borderRadius: 10,
                              background: 'rgba(255,255,255,0.04)',
                              border: '1px solid rgba(255,255,255,0.06)',
                            }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{item.head}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: moduleColor }}>₹{Number(item.amount).toLocaleString('en-IN')}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveAdditionalItem(index)}
                                  style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.15)', borderRadius: 6, width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171' }}
                                ><X size={11} /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {additionalCollectionsList.length === 0 && (
                        <p style={{ fontSize: 12, color: '#6b7280', margin: 0, fontStyle: 'italic' }}>No additional collections added yet.</p>
                      )}
                      {/* Add row */}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <SelectField value={newHead} onChange={e => setNewHead(e.target.value)} style={{ fontSize: 12, padding: '7px 10px', height: 36 }}>
                            <option value="">— Select head —</option>
                            {collectionHeads.filter(h => h.isActive).map(h => (
                              <option key={h._id} value={h.name}>{h.name}</option>
                            ))}
                          </SelectField>
                        </div>
                        <div style={{ width: 110 }}>
                          <NumberInput value={newHeadAmount} onChange={e => setNewHeadAmount(e.target.value)} placeholder="Amount" min={1} style={{ fontSize: 12, padding: '7px 10px', height: 36 }} />
                        </div>
                        <button
                          type="button"
                          onClick={handleAddAdditionalItem}
                          style={{
                            width: 36, height: 36, flexShrink: 0,
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 9, cursor: 'pointer', color: '#e2e8f0',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        ><Plus size={14} /></button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowAdditional(true)}
                      style={{
                        width: '100%', padding: '11px 0', borderRadius: 10,
                        border: '1.5px dashed rgba(255,255,255,0.08)',
                        background: 'transparent', color: '#6b7280',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = '#9ca3af'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#6b7280'; }}
                    >
                      <Plus size={13} /> Add additional collection
                    </button>
                  )}

                  {/* Live total preview */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', borderRadius: 12,
                    background: `${moduleColor}0d`,
                    border: `1px solid ${moduleColor}22`,
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Total collected</span>
                    <span style={{ fontSize: 18, fontWeight: 900, color: moduleColor }}>
                      ₹{((Number(amount)||0) + additionalCollectionsList.reduce((s, c) => s + (Number(c.amount)||0), 0)).toLocaleString('en-IN')}
                    </span>
                  </div>

                  {/* Notes */}
                  <div>
                    <SectionLabel>Notes (optional)</SectionLabel>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      rows={2}
                      placeholder="Any remarks…"
                      style={{
                        width: '100%', background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.09)',
                        borderRadius: 10, padding: '9px 12px',
                        fontSize: 13, color: '#e2e8f0',
                        outline: 'none', resize: 'none', boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {error && <AlertBanner icon={AlertTriangle} variant="danger">{error}</AlertBanner>}
                  {successMsg && <AlertBanner icon={CheckCircle} variant="success">{successMsg}</AlertBanner>}
                </div>

                {/* Modal footer */}
                <div style={{
                  padding: '16px 24px',
                  borderTop: '1px solid rgba(255,255,255,0.07)',
                  background: '#0d1b2a',
                  display: 'flex', gap: 10, flexShrink: 0,
                }}>
                  <button
                    type="button"
                    onClick={() => setFormOpen(false)}
                    style={{ ...ghostBtn, flex: 1, justifyContent: 'center' }}
                  >Cancel</button>
                  <button
                    type="submit"
                    style={{ ...glowBtn, flex: 1, justifyContent: 'center' }}
                  >{editingEntry ? 'Update entry' : 'Save entry'}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Floating bulk-delete bar ── */}
      <AnimatePresence>
        {selectedCollectionIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            style={{
              position: 'fixed', bottom: 24,
              left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(10,14,26,0.92)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(248,113,113,0.25)',
              borderRadius: 16,
              padding: '14px 20px',
              display: 'flex', alignItems: 'center', gap: 20,
              zIndex: 40,
              boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
              maxWidth: 420, width: '90vw',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(248,113,113,0.1)',
                border: '1px solid rgba(248,113,113,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Trash2 size={15} color="#f87171" />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{selectedCollectionIds.length} record{selectedCollectionIds.length !== 1 ? 's' : ''} selected</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>Choose an action below</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexShrink: 0 }}>
              <button
                onClick={() => setSelectedCollectionIds([])}
                style={{ ...ghostBtn, padding: '7px 12px', fontSize: 12 }}
              >Cancel</button>
              <button
                onClick={handleBulkDeleteCollections}
                style={{
                  padding: '7px 14px', borderRadius: 9, border: 'none',
                  background: '#f87171', color: '#fff',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              ><Trash2 size={12} /> Delete</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CollectionEntry;