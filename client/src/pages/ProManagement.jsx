import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import client from '../api/client';
import { Users, Plus, Edit, Trash2, ShieldAlert, Sparkles, Check, X, Search, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const MONTHS = ['April','May','June','July','August','September','October','November','December','January','February','March'];

const parseBulkText = (text, defaultModuleId) => {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
  const parsed = [];
  let startIndex = 0;
  if (lines.length > 0) {
    const firstLine = lines[0].toLowerCase();
    if (firstLine.includes('name') || firstLine.includes('designation') || firstLine.includes('mobile') || firstLine.includes('email')) {
      startIndex = 1;
    }
  }
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonthIdx = today.getMonth();
  const defaultStartYear = currentMonthIdx >= 3 ? currentYear : currentYear - 1;
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    let parts = [];
    if (line.includes('\t')) parts = line.split('\t');
    else if (line.includes(',')) parts = line.split(',');
    else parts = [line];
    const name = parts[0]?.trim() || '';
    const designation = parts[1]?.trim() || 'PRO Officer';
    const mobile = parts[2]?.trim() || '';
    const email = parts[3]?.trim() || '';
    if (name) {
      parsed.push({ name, designation: designation || 'PRO Officer', mobile: mobile || '', email: email || '', status: 'active', module: defaultModuleId, notes: '', joiningMonth: 'April', joiningYear: defaultStartYear });
    }
  }
  return parsed;
};

/* ─── Shared micro-components ─── */

const SectionLabel = ({ children }) => (
  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 6, marginTop: 0 }}>{children}</p>
);

const FieldInput = ({ type = 'text', value, onChange, placeholder, style, min }) => (
  <input
    type={type}
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    min={min}
    style={{
      width: '100%', background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10,
      padding: '9px 12px', fontSize: 13, color: '#e2e8f0',
      outline: 'none', boxSizing: 'border-box', ...style,
    }}
    onFocus={e => e.target.style.borderColor = 'rgba(212,175,55,0.45)'}
    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.09)'}
  />
);

const FieldSelect = ({ value, onChange, children, style }) => (
  <select
    value={value}
    onChange={onChange}
    style={{
      width: '100%', background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10,
      padding: '9px 12px', fontSize: 13, color: '#e2e8f0',
      outline: 'none', cursor: 'pointer', boxSizing: 'border-box',
      appearance: 'none',
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
      backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', paddingRight: 32, ...style,
    }}
    onFocus={e => e.target.style.borderColor = 'rgba(212,175,55,0.45)'}
    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.09)'}
  >{children}</select>
);

const card = { background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16 };

const goldBtn = {
  background: 'linear-gradient(135deg, #d4af37, #f0c040)', border: 'none',
  borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 700,
  color: '#0d1b2a', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
};

const ghostBtn = {
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 600,
  color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
};

/* ─── Avatar initials ─── */
const Avatar = ({ name, color }) => {
  const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return (
    <div style={{
      width: 42, height: 42, borderRadius: 12, flexShrink: 0,
      background: `${color}22`, border: `1.5px solid ${color}44`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 14, fontWeight: 800, color: color, letterSpacing: '-0.01em',
    }}>{initials}</div>
  );
};

/* ─── Overlay modal shell ─── */
const ModalShell = ({ open, onClose, children, maxWidth = 520, title, icon: Icon }) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(6px)', zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0, y: 14 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 14 }}
          transition={{ duration: 0.18, ease: [0.22,1,0.36,1] }}
          style={{
            background: '#0d1b2a', border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 20, width: '100%', maxWidth,
            maxHeight: '90vh', display: 'flex', flexDirection: 'column',
            overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
          }}
        >
          <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {Icon && <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={15} color="#d4af37" /></div>}
              <span style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9' }}>{title}</span>
            </div>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
          </div>
          {children}
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

/* ─── Main Component ─── */
const ProManagement = () => {
  const { user, refreshMetadata, modules, selectedModule } = useApp();
  const [pros, setPros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPro, setEditingPro] = useState(null);

  const filteredPros = pros.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.designation && p.designation.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const [selectedProIds, setSelectedProIds] = useState([]);

  useEffect(() => { setSelectedProIds([]); }, [selectedModule, searchTerm]);

  const handleToggleSelect = (id) => {
    setSelectedProIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleToggleSelectAll = () => {
    if (selectedProIds.length === filteredPros.length && filteredPros.length > 0) setSelectedProIds([]);
    else setSelectedProIds(filteredPros.map(p => p._id));
  };

  const handleBulkDelete = async () => {
    if (selectedProIds.length === 0) return;
    const count = selectedProIds.length;
    if (!window.confirm(`Are you sure you want to delete the ${count} selected PRO officer(s)? This will also delete all their associated collection entries and CANNOT be undone.`)) return;
    try {
      const res = await client.delete('/api/pros/bulk', { data: { ids: selectedProIds } });
      if (res.data.success) { setPros(pros.filter(p => !selectedProIds.includes(p._id))); setSelectedProIds([]); refreshMetadata(); }
    } catch (err) { alert(err.response?.data?.message || 'Failed to bulk delete PRO officers'); }
  };

  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('active');
  const [notes, setNotes] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [joiningMonth, setJoiningMonth] = useState('April');
  const [joiningYear, setJoiningYear] = useState('');
  const [error, setError] = useState('');

  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkStep, setBulkStep] = useState(1);
  const [bulkRawText, setBulkRawText] = useState('');
  const [bulkParsedPros, setBulkParsedPros] = useState([]);
  const [bulkDefaultModuleId, setBulkDefaultModuleId] = useState('');
  const [bulkErrors, setBulkErrors] = useState([]);
  const [bulkSuccessCount, setBulkSuccessCount] = useState(0);

  const openBulkModal = () => {
    setBulkStep(1); setBulkRawText(''); setBulkParsedPros([]);
    const firstRealModule = modules.find(m => m.code !== 'all');
    setBulkDefaultModuleId((selectedModule && selectedModule.code !== 'all') ? selectedModule._id : (firstRealModule?._id || ''));
    setBulkErrors([]); setBulkSuccessCount(0); setBulkModalOpen(true);
  };

  const handleParseBulk = () => {
    if (!bulkRawText.trim()) { setBulkErrors(['Please paste some data to import']); return; }
    setBulkErrors([]);
    const parsed = parseBulkText(bulkRawText, bulkDefaultModuleId);
    if (parsed.length === 0) { setBulkErrors(['Could not parse any valid rows. Please check formatting.']); return; }
    setBulkParsedPros(parsed); setBulkStep(2);
  };

  const handleBulkFieldChange = (index, field, value) => {
    const updated = [...bulkParsedPros]; updated[index][field] = value; setBulkParsedPros(updated);
  };

  const handleBulkDeleteRow = (index) => { setBulkParsedPros(bulkParsedPros.filter((_, i) => i !== index)); };

  const handleBulkAddRow = () => {
    const today = new Date();
    const defaultStartYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
    setBulkParsedPros([...bulkParsedPros, { name: '', designation: 'PRO Officer', mobile: '', email: '', status: 'active', module: bulkDefaultModuleId, notes: '', joiningMonth: 'April', joiningYear: defaultStartYear }]);
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    const invalidRows = [];
    bulkParsedPros.forEach((pro, index) => {
      if (!pro.name.trim()) invalidRows.push(`Row ${index + 1}: Name is required.`);
      if (!pro.module) invalidRows.push(`Row ${index + 1}: Module is required.`);
      if (!pro.joiningMonth) invalidRows.push(`Row ${index + 1}: Joining Month is required.`);
      if (!pro.joiningYear) invalidRows.push(`Row ${index + 1}: Joining Year is required.`);
    });
    if (invalidRows.length > 0) { setBulkErrors(invalidRows); return; }
    setBulkErrors([]);
    try {
      const res = await client.post('/api/pros/bulk', { pros: bulkParsedPros });
      if (res.data.success) {
        setBulkSuccessCount(res.data.data.length);
        setBulkErrors(res.data.errors?.length > 0 ? res.data.errors : []);
        setPros([...pros, ...res.data.data]);
        setBulkStep(3); refreshMetadata();
      }
    } catch (err) { setBulkErrors([err.response?.data?.message || 'Something went wrong during bulk registration']); }
  };

  const fetchPros = async () => {
    setLoading(true);
    try {
      const params = selectedModule && selectedModule.code !== 'all' ? `?module=${selectedModule._id}` : '';
      const res = await client.get(`/api/pros${params}`);
      if (res.data.success) setPros(res.data.data);
    } catch (err) { console.error('Failed to fetch PROs', err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchPros(); }, [selectedModule]);

  const openAddModal = () => {
    setEditingPro(null); setName(''); setDesignation('PRO Officer'); setMobile(''); setEmail('');
    setStatus('active'); setNotes('');
    const defaultModule = modules.find(m => m.code !== 'all')?._id || '';
    setModuleId(selectedModule && selectedModule.code !== 'all' ? selectedModule._id : defaultModule);
    const today = new Date();
    const defaultStartYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
    setJoiningMonth('April'); setJoiningYear(defaultStartYear.toString()); setError(''); setModalOpen(true);
  };

  const openEditModal = (pro) => {
    setEditingPro(pro); setName(pro.name); setDesignation(pro.designation || 'PRO Officer');
    setMobile(pro.mobile || ''); setEmail(pro.email || ''); setStatus(pro.status || 'active'); setNotes(pro.notes || '');
    const defaultModule = modules.find(m => m.code !== 'all')?._id || '';
    setModuleId(pro.module?._id || pro.module || (selectedModule && selectedModule.code !== 'all' ? selectedModule._id : defaultModule));
    setJoiningMonth(pro.joiningMonth || 'April');
    setJoiningYear(pro.joiningYear ? pro.joiningYear.toString() : '');
    setError(''); setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name) { setError('Name is a required field'); return; }
    if (!moduleId) { setError('Please select a module for this PRO officer'); return; }
    if (!joiningMonth) { setError('Joining Month is a required field'); return; }
    if (!joiningYear) { setError('Joining Year is a required field'); return; }
    setError('');
    const proData = { name, designation, mobile, email, status, notes, module: moduleId, joiningMonth, joiningYear: Number(joiningYear) };
    try {
      if (editingPro) {
        const res = await client.put(`/api/pros/${editingPro._id}`, proData);
        if (res.data.success) setPros(pros.map(p => p._id === editingPro._id ? res.data.data : p));
      } else {
        const res = await client.post('/api/pros', proData);
        if (res.data.success) setPros([...pros, res.data.data]);
      }
      setModalOpen(false); refreshMetadata();
    } catch (err) { setError(err.response?.data?.message || 'Something went wrong'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this PRO? This cannot be undone.')) return;
    try {
      const res = await client.delete(`/api/pros/${id}`);
      if (res.data.success) { setPros(pros.filter(p => p._id !== id)); refreshMetadata(); }
    } catch (err) { alert(err.response?.data?.message || 'Failed to delete PRO'); }
  };

  const toggleStatus = async (pro) => {
    try {
      const res = await client.patch(`/api/pros/${pro._id}/toggle-status`);
      if (res.data.success) { setPros(pros.map(p => p._id === pro._id ? res.data.data : p)); refreshMetadata(); }
    } catch (err) { alert('Failed to change status'); }
  };

  /* ─── Render ─── */
  return (
    <div style={{ padding: '28px 24px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.02em' }}>
            PRO{' '}
            <span style={{ background: 'linear-gradient(90deg, #d4af37, #f0c040aa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Management</span>
          </h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '6px 0 0' }}>Register, edit, and configure PRO officers</p>
        </div>
        {user?.role === 'admin' && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={openBulkModal} style={{
              ...ghostBtn, color: '#d4af37',
              border: '1px solid rgba(212,175,55,0.25)',
              background: 'rgba(212,175,55,0.07)',
            }}>
              <Users size={14} /> Bulk register
            </button>
            <button onClick={openAddModal} style={goldBtn}>
              <Plus size={14} /> Add officer
            </button>
          </div>
        )}
      </div>

      {/* Controls bar */}
      <div style={{ ...card, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6b7280', pointerEvents: 'none' }} />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by name or designation…"
              style={{
                width: 280, background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
                padding: '8px 12px 8px 34px', fontSize: 13, color: '#e2e8f0',
                outline: 'none',
              }}
            />
          </div>
          {/* Select all */}
          {user?.role === 'admin' && filteredPros.length > 0 && (
            <button onClick={handleToggleSelectAll} style={{ ...ghostBtn, padding: '8px 14px', fontSize: 12, gap: 8 }}>
              <input
                type="checkbox"
                readOnly
                checked={selectedProIds.length === filteredPros.length && filteredPros.length > 0}
                style={{ width: 13, height: 13, accentColor: '#d4af37', cursor: 'pointer' }}
              />
              {selectedProIds.length === filteredPros.length ? 'Deselect all' : 'Select all'}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Users size={14} color="rgba(212,175,55,0.6)" />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
            {filteredPros.length} officers
          </span>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', border: '2.5px solid rgba(212,175,55,0.2)', borderTopColor: '#d4af37', animation: 'spin 0.9s linear infinite' }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : filteredPros.length === 0 ? (
        <div style={{ ...card, padding: '60px 24px', textAlign: 'center' }}>
          <Users size={32} color="#374151" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: 14, color: '#6b7280', fontWeight: 600 }}>No officers found</div>
          <div style={{ fontSize: 12, color: '#4b5563', marginTop: 4 }}>Try adjusting your search or add a new officer.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {filteredPros.map(pro => {
            const moduleColor = pro.module?.color || '#d4af37';
            const isSelected = selectedProIds.includes(pro._id);
            return (
              <motion.div
                key={pro._id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: isSelected ? `rgba(212,175,55,0.04)` : 'rgba(255,255,255,0.025)',
                  border: isSelected ? '1px solid rgba(212,175,55,0.35)' : '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 16, padding: 20,
                  display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                  transition: 'border-color 0.2s, background 0.2s',
                }}
              >
                {/* Top */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      {user?.role === 'admin' && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(pro._id)}
                          style={{ marginTop: 14, width: 13, height: 13, accentColor: '#d4af37', cursor: 'pointer', flexShrink: 0 }}
                        />
                      )}
                      <Avatar name={pro.name} color={moduleColor} />
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', lineHeight: 1.3 }}>{pro.name}</div>
                        <div style={{ fontSize: 11, color: '#d4af37', fontWeight: 600, marginTop: 2 }}>{pro.designation || 'PRO Officer'}</div>
                        {pro.module && (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, marginTop: 5,
                            color: moduleColor, background: `${moduleColor}18`, border: `1px solid ${moduleColor}33`,
                          }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: moduleColor, display: 'inline-block' }} />
                            {pro.module?.name}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => user?.role === 'admin' && toggleStatus(pro)}
                      style={{
                        padding: '3px 9px', borderRadius: 99, border: 'none', cursor: user?.role === 'admin' ? 'pointer' : 'default',
                        fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', flexShrink: 0,
                        ...(pro.status === 'active'
                          ? { background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }
                          : { background: 'rgba(107,114,128,0.1)', color: '#9ca3af', border: '1px solid rgba(107,114,128,0.2)' }),
                      }}
                    >{pro.status}</button>
                  </div>

                  {/* Details */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 14 }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>Joined</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>
                        {pro.joiningMonth && pro.joiningYear ? `${pro.joiningMonth} ${pro.joiningYear}` : 'Not available'}
                      </div>
                    </div>
                    {pro.mobile && (
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>Mobile</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{pro.mobile}</div>
                      </div>
                    )}
                    {pro.email && (
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>Email</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pro.email}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom actions */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <Link
                    to={`/pro/${pro._id}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#d4af37', textDecoration: 'none' }}
                  >
                    <Eye size={13} /> View analytics
                  </Link>
                  {user?.role === 'admin' && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => openEditModal(pro)}
                        style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      ><Edit size={13} /></button>
                      <button
                        onClick={() => handleDelete(pro._id)}
                        style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      ><Trash2 size={13} /></button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ═══════════════ Single PRO Modal ═══════════════ */}
      <ModalShell open={modalOpen} onClose={() => setModalOpen(false)} title={editingPro ? 'Edit PRO officer' : 'Add PRO officer'} icon={Sparkles}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 12, padding: '10px 14px', color: '#f87171', fontSize: 13 }}>
              <ShieldAlert size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <SectionLabel>Full name *</SectionLabel>
              <FieldInput value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Ahmed Al-Rashidi" />
            </div>
            <div>
              <SectionLabel>Designation</SectionLabel>
              <FieldInput value={designation} onChange={e => setDesignation(e.target.value)} placeholder="e.g. Senior PRO" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <SectionLabel>Mobile</SectionLabel>
                <FieldInput value={mobile} onChange={e => setMobile(e.target.value)} placeholder="050-1234567" />
              </div>
              <div>
                <SectionLabel>Email</SectionLabel>
                <FieldInput type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ahmed@domain.com" />
              </div>
            </div>
            <div>
              <SectionLabel>Collection module *</SectionLabel>
              <FieldSelect value={moduleId} onChange={e => setModuleId(e.target.value)}>
                <option value="">Select module</option>
                {modules.filter(m => m.code !== 'all').map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
              </FieldSelect>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <SectionLabel>Joining month *</SectionLabel>
                <FieldSelect value={joiningMonth} onChange={e => setJoiningMonth(e.target.value)}>
                  <option value="">Select month</option>
                  {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                </FieldSelect>
              </div>
              <div>
                <SectionLabel>Joining year *</SectionLabel>
                <FieldInput type="number" value={joiningYear} onChange={e => setJoiningYear(e.target.value)} placeholder="2026" />
              </div>
            </div>
            <div>
              <SectionLabel>Status</SectionLabel>
              <FieldSelect value={status} onChange={e => setStatus(e.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </FieldSelect>
            </div>
            <div>
              <SectionLabel>Notes (optional)</SectionLabel>
              <textarea
                value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Additional profile information…" rows={2}
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10, padding: '9px 12px', fontSize: 13, color: '#e2e8f0', outline: 'none', resize: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
              <button type="button" onClick={() => setModalOpen(false)} style={{ ...ghostBtn, flex: 1, justifyContent: 'center' }}>Cancel</button>
              <button type="submit" style={{ ...goldBtn, flex: 1, justifyContent: 'center' }}>
                {editingPro ? 'Save changes' : 'Register officer'}
              </button>
            </div>
          </form>
        </div>
      </ModalShell>

      {/* ═══════════════ Bulk Registration Modal ═══════════════ */}
      <ModalShell open={bulkModalOpen} onClose={() => setBulkModalOpen(false)} maxWidth={900} title="Bulk officer registration" icon={Users}>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '20px 24px', gap: 16, overflowY: 'auto' }}>
          {bulkErrors.length > 0 && (
            <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 12, padding: '12px 14px', color: '#f87171', fontSize: 12, maxHeight: 120, overflowY: 'auto', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: 6 }}><ShieldAlert size={13} /> Errors / Warnings</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>{bulkErrors.map((e, i) => <li key={i} style={{ marginBottom: 2 }}>{e}</li>)}</ul>
            </div>
          )}

          {/* Step 1 */}
          {bulkStep === 1 && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, flexShrink: 0 }}>
                <div>
                  <SectionLabel>Default module for batch</SectionLabel>
                  <FieldSelect value={bulkDefaultModuleId} onChange={e => setBulkDefaultModuleId(e.target.value)}>
                    <option value="">Select module</option>
                    {modules.filter(m => m.code !== 'all').map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
                  </FieldSelect>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '12px 14px', fontSize: 12, color: '#9ca3af' }}>
                  <div style={{ fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>Instructions</div>
                  Paste data from Excel or type comma/tab separated rows.<br />
                  Columns: <span style={{ color: '#d4af37', fontWeight: 600 }}>Name | Designation | Mobile | Email</span>. Header is auto-skipped.
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <SectionLabel>Paste Excel/CSV data</SectionLabel>
                <textarea
                  value={bulkRawText}
                  onChange={e => setBulkRawText(e.target.value)}
                  placeholder={'Ahmed Al-Rashidi\tSenior PRO\t050-1234567\tahmed@domain.com\nJohn Smith\tPRO Officer\t052-7654321\tjohn@domain.com'}
                  style={{ width: '100%', minHeight: 160, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#e2e8f0', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'monospace' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setBulkModalOpen(false)} style={{ ...ghostBtn, flex: 1, justifyContent: 'center' }}>Cancel</button>
                <button type="button" onClick={handleParseBulk} style={{ ...goldBtn, flex: 1, justifyContent: 'center' }}>Parse & preview</button>
              </div>
            </>
          )}

          {/* Step 2 */}
          {bulkStep === 2 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <span style={{ fontSize: 13, color: '#9ca3af' }}>Review and edit below before saving.</span>
                <button onClick={handleBulkAddRow} style={{ ...ghostBtn, fontSize: 12, padding: '6px 12px' }}>
                  <Plus size={12} /> Add row
                </button>
              </div>
              <div style={{ flex: 1, minHeight: 0, border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 820 }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)', position: 'sticky', top: 0, zIndex: 2 }}>
                      {['Name *', 'Designation', 'Mobile', 'Email', 'Module *', 'Joining month *', 'Joining year *', ''].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#6b7280', letterSpacing: '0.07em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bulkParsedPros.map((pro, index) => (
                      <tr key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        {[
                          { field: 'name', type: 'text', ph: 'Name', err: !pro.name.trim() },
                          { field: 'designation', type: 'text', ph: 'Designation' },
                          { field: 'mobile', type: 'text', ph: 'Mobile' },
                          { field: 'email', type: 'text', ph: 'Email' },
                        ].map(({ field, type, ph, err }) => (
                          <td key={field} style={{ padding: '6px 8px' }}>
                            <input
                              type={type}
                              value={pro[field]}
                              onChange={e => handleBulkFieldChange(index, field, e.target.value)}
                              placeholder={ph}
                              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${err ? 'rgba(248,113,113,0.4)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 8, padding: '6px 9px', fontSize: 12, color: '#e2e8f0', outline: 'none', boxSizing: 'border-box' }}
                            />
                          </td>
                        ))}
                        <td style={{ padding: '6px 8px' }}>
                          <select value={pro.module} onChange={e => handleBulkFieldChange(index, 'module', e.target.value)}
                            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 9px', fontSize: 12, color: '#e2e8f0', outline: 'none' }}>
                            <option value="">Module</option>
                            {modules.filter(m => m.code !== 'all').map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <select value={pro.joiningMonth || 'April'} onChange={e => handleBulkFieldChange(index, 'joiningMonth', e.target.value)}
                            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 9px', fontSize: 12, color: '#e2e8f0', outline: 'none' }}>
                            {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <input type="number" value={pro.joiningYear || ''} onChange={e => handleBulkFieldChange(index, 'joiningYear', Number(e.target.value))} placeholder="Year"
                            style={{ width: 80, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 9px', fontSize: 12, color: '#e2e8f0', outline: 'none' }} />
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                          <button onClick={() => handleBulkDeleteRow(index)}
                            style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)', color: '#f87171', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setBulkStep(1)} style={{ ...ghostBtn, flex: 1, justifyContent: 'center' }}>← Back</button>
                <button type="button" onClick={handleBulkSubmit} style={{ ...goldBtn, flex: 1, justifyContent: 'center' }}>
                  Register {bulkParsedPros.length} officers
                </button>
              </div>
            </>
          )}

          {/* Step 3 */}
          {bulkStep === 3 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 0', textAlign: 'center', gap: 20 }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Check size={28} color="#34d399" />
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9', marginBottom: 6 }}>Bulk registration complete</div>
                <p style={{ fontSize: 14, color: '#9ca3af', margin: 0 }}>
                  Successfully registered <span style={{ color: '#d4af37', fontWeight: 700 }}>{bulkSuccessCount}</span> new PRO officers.
                </p>
              </div>
              {bulkErrors.length > 0 && (
                <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 12, padding: '14px 16px', color: '#f87171', fontSize: 12, textAlign: 'left', maxWidth: 480, width: '100%', maxHeight: 140, overflowY: 'auto' }}>
                  <div style={{ fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}><ShieldAlert size={13} /> Some rows failed:</div>
                  <ul style={{ margin: 0, paddingLeft: 16 }}>{bulkErrors.map((e, i) => <li key={i} style={{ marginBottom: 3 }}>{e}</li>)}</ul>
                </div>
              )}
              <button type="button" onClick={() => { setBulkModalOpen(false); fetchPros(); }} style={{ ...goldBtn, padding: '11px 28px' }}>
                Done & close
              </button>
            </div>
          )}
        </div>
      </ModalShell>

      {/* Floating bulk-delete bar */}
      <AnimatePresence>
        {selectedProIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            style={{
              position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(10,14,26,0.92)', backdropFilter: 'blur(12px)',
              border: '1px solid rgba(248,113,113,0.25)', borderRadius: 16,
              padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 20,
              zIndex: 40, boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
              maxWidth: 440, width: '90vw',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Trash2 size={15} color="#f87171" />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{selectedProIds.length} PRO{selectedProIds.length !== 1 ? 's' : ''} selected</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>Bulk delete clears all associated collections.</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexShrink: 0 }}>
              <button onClick={() => setSelectedProIds([])} style={{ ...ghostBtn, padding: '7px 12px', fontSize: 12 }}>Cancel</button>
              <button onClick={handleBulkDelete} style={{ padding: '7px 14px', borderRadius: 9, border: 'none', background: '#f87171', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Trash2 size={12} /> Delete
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProManagement;