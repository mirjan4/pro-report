import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import client from '../api/client';
import EChartWrapper from '../components/EChartWrapper';
import {
  Presentation, Play, Download, Save, Trash2, Edit, Check, X, Plus,
  Settings, Layers, ChevronUp, ChevronDown, Calendar, Clock, Lock,
  Globe, Share2, Copy, BarChart3, LineChart, PieChart, Users, Award,
  Sparkles, HeartHandshake, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import pptxgen from 'pptxgenjs';

const MONTHS = ['April','May','June','July','August','September','October','November','December','January','February','March'];

const DEFAULT_SLIDES = [
  { id: 'cover', title: 'Cover Page', enabled: true },
  { id: 'summary', title: 'Executive Summary', enabled: true },
  { id: 'coll_summary', title: 'Collection Summary', enabled: true },
  { id: 'cat_details', title: 'Category Collection Details', enabled: true },
  { id: 'top_contributors', title: 'Top Contributors', enabled: true },
  { id: 'sponsor_summary', title: 'Sponsor Summary', enabled: true },
  { id: 'sponsor_rankings', title: 'Sponsor Rankings', enabled: true },
  { id: 'dist_analysis', title: 'Distribution Analysis', enabled: true },
  { id: 'monthly_comparison', title: 'Monthly Comparison', enabled: true },
  { id: 'annual_comparison', title: 'Annual Comparison', enabled: true },
  { id: 'growth_trends', title: 'Growth Trends', enabled: true },
  { id: 'ai_insights', title: 'AI Insights', enabled: true },
  { id: 'pro_detail', title: 'PRO Collection Detail', enabled: true },
  { id: 'direct_cols', title: 'Direct Collections Through PROs', enabled: true },
  { id: 'closing', title: 'Closing Slide', enabled: true }
].map((s, idx) => ({ ...s, order: idx }));

const PresentationBuilder = () => {
  const { financialYears, selectedFY, modules, selectedModule } = useApp();
  const [presentations, setPresentations] = useState([]);
  const [selectedPresId, setSelectedPresId] = useState(null);
  
  // Builder Configurations
  const [title, setTitle] = useState('TAKAFUL MANAGEMENT REPORT');
  const [collectionFilter, setCollectionFilter] = useState('all');
  const [periodType, setPeriodType] = useState('financialYear');
  const [customRange, setCustomRange] = useState({ startDate: '', endDate: '' });
  const [fySelection, setFySelection] = useState('all');
  const [moduleSelection, setModuleSelection] = useState('all');
  const [slides, setSlides] = useState(DEFAULT_SLIDES);
  const [liveData, setLiveData] = useState(true);

  // Access Control
  const [isPublic, setIsPublic] = useState(true);
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [password, setPassword] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  // UI state
  const [activeTab, setActiveTab] = useState('list'); // 'list', 'new', 'slides', 'preview'
  const [loading, setLoading] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [compiledData, setCompiledData] = useState(null);
  const [copySuccess, setCopySuccess] = useState(null);

  useEffect(() => {
    fetchPresentations();
  }, []);

  useEffect(() => {
    if (selectedFY) {
      setFySelection(selectedFY._id);
    }
  }, [selectedFY]);

  const fetchPresentations = async () => {
    setLoading(true);
    try {
      const res = await client.get('/api/presentations');
      if (res.data.success) {
        setPresentations(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load presentations', err);
    } finally {
      setLoading(false);
    }
  };

  // Compile data for previews
  const handleCompilePreview = async () => {
    setCompiling(true);
    try {
      const payload = {
        collectionFilter,
        periodType,
        customRange,
        financialYear: fySelection !== 'all' ? fySelection : null,
        module: moduleSelection !== 'all' ? moduleSelection : null
      };
      const res = await client.post('/api/presentations/preview-data', payload);
      if (res.data.success) {
        setCompiledData(res.data.data);
      }
    } catch (err) {
      console.error('Data compilation failed', err);
      alert('Failed to compile presentation preview data.');
    } finally {
      setCompiling(false);
    }
  };

  const moveSlide = (index, direction) => {
    const newSlides = [...slides];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSlides.length) return;
    
    const temp = newSlides[index];
    newSlides[index] = newSlides[targetIndex];
    newSlides[targetIndex] = temp;

    newSlides.forEach((s, idx) => {
      s.order = idx;
    });
    setSlides(newSlides);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      alert('Please enter a presentation title.');
      return;
    }

    setLoading(true);
    const payload = {
      title,
      collectionFilter,
      periodType,
      customRange,
      financialYear: fySelection !== 'all' ? fySelection : null,
      module: moduleSelection !== 'all' ? moduleSelection : null,
      slides,
      liveData,
      accessControl: {
        isPublic,
        isPasswordProtected,
        password: isPasswordProtected ? password : null,
        expiresAt: expiresAt || null
      }
    };

    try {
      let res;
      if (selectedPresId) {
        res = await client.put(`/api/presentations/${selectedPresId}`, payload);
      } else {
        res = await client.post('/api/presentations', payload);
      }

      if (res.data.success) {
        alert(selectedPresId ? 'Presentation updated!' : 'Presentation created successfully!');
        fetchPresentations();
        setActiveTab('list');
        resetForm();
      }
    } catch (err) {
      console.error('Save failed', err);
      alert(err.response?.data?.message || 'Failed to save presentation.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (pres) => {
    setSelectedPresId(pres._id);
    setTitle(pres.title);
    setCollectionFilter(pres.collectionFilter || 'all');
    setPeriodType(pres.periodType || 'monthly');
    setCustomRange(pres.customRange || { startDate: '', endDate: '' });
    setFySelection(pres.financialYear?._id || pres.financialYear || 'all');
    setModuleSelection(pres.module?._id || pres.module || 'all');
    
    // Merge slides with default in case slides schema changes
    const mergedSlides = DEFAULT_SLIDES.map(def => {
      const saved = pres.slides?.find(s => s.id === def.id);
      return saved ? { ...def, ...saved } : def;
    }).sort((a, b) => a.order - b.order);

    setSlides(mergedSlides);
    setLiveData(pres.liveData ?? true);
    setIsPublic(pres.accessControl?.isPublic ?? true);
    setIsPasswordProtected(pres.accessControl?.isPasswordProtected ?? false);
    setPassword('');
    setExpiresAt(pres.accessControl?.expiresAt ? new Date(pres.accessControl.expiresAt).toISOString().split('T')[0] : '');
    
    setCompiledData(null);
    setActiveTab('new');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this presentation config?')) return;
    try {
      const res = await client.delete(`/api/presentations/${id}`);
      if (res.data.success) {
        fetchPresentations();
      }
    } catch (err) {
      alert('Delete failed');
    }
  };

  const resetForm = () => {
    setSelectedPresId(null);
    setTitle('TAKAFUL MANAGEMENT REPORT');
    setCollectionFilter('all');
    setPeriodType('financialYear');
    setCustomRange({ startDate: '', endDate: '' });
    setFySelection('all');
    setModuleSelection('all');
    setSlides(DEFAULT_SLIDES);
    setLiveData(true);
    setIsPublic(true);
    setIsPasswordProtected(false);
    setPassword('');
    setExpiresAt('');
    setCompiledData(null);
  };

  const copyShareLink = (id) => {
    const link = `${window.location.origin}/presentation/${id}`;
    navigator.clipboard.writeText(link);
    setCopySuccess(id);
    setTimeout(() => setCopySuccess(null), 2000);
  };

  // PDF Export captures slides
  const exportPDF = async () => {
    if (!compiledData) {
      alert('Please compile preview data first.');
      return;
    }
    setExporting(true);
    try {
      const doc = new jsPDF('l', 'mm', 'a4'); // Landscape A4
      const enabledSlides = slides.filter(s => s.enabled);

      for (let i = 0; i < enabledSlides.length; i++) {
        const slide = enabledSlides[i];
        const el = document.getElementById(`slide-render-${slide.id}`);
        if (el) {
          const canvas = await html2canvas(el, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#0a1128'
          });
          const imgData = canvas.toDataURL('image/png');
          if (i > 0) doc.addPage();
          doc.addImage(imgData, 'PNG', 0, 0, 297, 210); // fits landscape A4 perfectly
        }
      }
      doc.save(`${title.replace(/\s+/g, '_')}_Presentation.pdf`);
    } catch (err) {
      console.error('PDF export failed', err);
      alert('Failed to export landscape PDF.');
    } finally {
      setExporting(false);
    }
  };

  // PowerPoint Export captures slides and embeds as screenshots
  const exportPPTX = async () => {
    if (!compiledData) {
      alert('Please compile preview data first.');
      return;
    }
    setExporting(true);
    try {
      const pptx = new pptxgen();
      pptx.layout = 'LAYOUT_16x9';

      const enabledSlides = slides.filter(s => s.enabled);

      for (let i = 0; i < enabledSlides.length; i++) {
        const slideConfig = enabledSlides[i];
        const slide = pptx.addSlide();
        slide.background = { color: '0a1128' };

        const el = document.getElementById(`slide-render-${slideConfig.id}`);
        if (el) {
          const canvas = await html2canvas(el, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#0a1128'
          });
          const imgData = canvas.toDataURL('image/png');
          slide.addImage({ data: imgData, x: 0, y: 0, w: '100%', h: '100%' });
        } else {
          slide.addText(slideConfig.title, { x: 1, y: 1, color: 'd4af37', fontSize: 24 });
        }
      }

      pptx.writeFile({ fileName: `${title.replace(/\s+/g, '_')}_Presentation.pptx` });
    } catch (err) {
      console.error('PPTX export failed', err);
      alert('Failed to export PowerPoint deck.');
    } finally {
      setExporting(false);
    }
  };

  // Chart configuration generators
  const getCollectionTrendOption = () => {
    if (!compiledData) return {};
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(13, 27, 42, 0.9)',
        borderColor: 'rgba(245, 197, 24, 0.3)',
        textStyle: { color: '#fff' }
      },
      grid: { left: '4%', right: '4%', bottom: '8%', top: '10%', containLabel: true },
      xAxis: {
        type: 'category',
        data: MONTHS.map(m => m.substring(0, 3)),
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: { color: '#fff', fontSize: 14 }
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
        axisLabel: { color: '#fff', fontSize: 12, formatter: (v) => v >= 100000 ? `${(v/100000).toFixed(1)}L` : v }
      },
      series: [{
        name: 'Takaful Collection',
        type: 'line',
        smooth: true,
        symbolSize: 10,
        itemStyle: { color: '#f5c518' },
        lineStyle: { width: 4 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(245, 197, 24, 0.3)' },
              { offset: 1, color: 'transparent' }
            ]
          }
        },
        data: compiledData.monthlySummary.map(m => m.total)
      }]
    };
  };

  const getCategoryShareOption = () => {
    if (!compiledData) return {};
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: '{b}: ₹{c} ({d}%)',
        backgroundColor: 'rgba(13, 27, 42, 0.9)',
        borderColor: 'rgba(245, 197, 24, 0.3)',
        textStyle: { color: '#fff' }
      },
      legend: { bottom: '0%', left: 'center', textStyle: { color: '#fff', fontSize: 12 } },
      series: [{
        name: 'Categories',
        type: 'pie',
        radius: ['45%', '70%'],
        padAngle: 3,
        itemStyle: { borderRadius: 10 },
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 16, fontWeight: 'bold', formatter: '{b}\n{d}%', color: '#fff' } },
        data: compiledData.categoryShare.map(c => ({ value: c.value, name: c.name, itemStyle: { color: c.color } }))
      }]
    };
  };

  const getSponsorGrowthOption = () => {
    if (!compiledData) return {};
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(13, 27, 42, 0.9)',
        borderColor: 'rgba(245, 197, 24, 0.3)',
        textStyle: { color: '#fff' }
      },
      grid: { left: '4%', right: '4%', bottom: '8%', top: '10%', containLabel: true },
      xAxis: {
        type: 'category',
        data: MONTHS.map(m => m.substring(0, 3)),
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: { color: '#fff', fontSize: 14 }
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
        axisLabel: { color: '#fff', fontSize: 12 }
      },
      series: [{
        name: 'Cumulative Sponsors',
        type: 'line',
        smooth: true,
        symbolSize: 8,
        itemStyle: { color: '#f5c518' },
        lineStyle: { width: 4 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(245, 197, 24, 0.2)' },
              { offset: 1, color: 'transparent' }
            ]
          }
        },
        data: compiledData.sponsorGrowth.map(g => g.cumulative)
      }]
    };
  };

  const getDistributionOption = () => {
    if (!compiledData) return {};
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: '{b}: ₹{c} ({d}%)',
        backgroundColor: 'rgba(13, 27, 42, 0.9)',
        borderColor: 'rgba(245, 197, 24, 0.3)',
        textStyle: { color: '#fff' }
      },
      legend: { bottom: '0%', left: 'center', textStyle: { color: '#fff', fontSize: 12 } },
      series: [{
        name: 'Distributions',
        type: 'pie',
        radius: ['45%', '70%'],
        padAngle: 3,
        itemStyle: { borderRadius: 10 },
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 16, fontWeight: 'bold', formatter: '{b}\n{d}%', color: '#fff' } },
        data: compiledData.distributionAnalysis.map((c, idx) => ({
          value: c.value,
          name: c.name,
          itemStyle: { color: ['#f5c518', '#2563eb', '#10b981', '#ef4444', '#8b5cf6'][idx % 5] }
        }))
      }]
    };
  };

  // Format Helper
  const formatRupee = (value) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value || 0);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <Presentation className="w-8 h-8 text-gold" />
            Presentation <span className="gold-gradient-text">Builder</span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Build and share dynamic slideshow decks for board and management meetings
          </p>
        </div>

        <div className="flex gap-2">
          {activeTab !== 'list' && (
            <button
              onClick={() => { setActiveTab('list'); resetForm(); }}
              className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm font-bold text-gray-300 hover:bg-white/10 transition cursor-pointer"
            >
              Cancel
            </button>
          )}
          {activeTab === 'list' && (
            <button
              onClick={() => { resetForm(); setActiveTab('new'); }}
              className="px-4 py-2.5 bg-gradient-to-r from-gold to-gold-accent text-dark-bg font-bold rounded-xl text-sm hover:shadow-lg hover:shadow-gold/10 transition cursor-pointer flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> New Deck
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      {activeTab !== 'list' && (
        <div className="flex space-x-2 border-b border-white/5 pb-2">
          {[
            { id: 'new', label: '1. Deck Parameters', icon: Settings },
            { id: 'slides', label: '2. Slide Customization & Order', icon: Layers },
            { id: 'preview', label: '3. Preview & Export', icon: Eye }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => {
                if (t.id === 'preview' && !compiledData) {
                  handleCompilePreview();
                }
                setActiveTab(t.id);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition cursor-pointer ${
                activeTab === t.id ? 'bg-gradient-to-r from-gold to-gold-accent text-dark-bg font-extrabold shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Tab Contents */}
      
      {/* 1. LIST PRESENTATIONS */}
      {activeTab === 'list' && (
        <div className="glass-card p-6 border border-white/10 space-y-6">
          <h2 className="text-xl font-bold text-white">Saved Presentations</h2>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-gold" />
            </div>
          ) : presentations.length === 0 ? (
            <div className="text-center py-16 text-gray-500 text-sm">
              No presentations saved yet. Click "New Deck" above to create one.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {presentations.map(pres => (
                <div key={pres._id} className="border border-white/5 bg-white/[0.01] hover:border-gold/30 rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all duration-200 shadow-md">
                  <div>
                    <h3 className="font-bold text-white text-lg truncate" title={pres.title}>{pres.title}</h3>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-gold/20 bg-gold/5 text-gold font-bold uppercase">
                        {pres.periodType}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-gray-300 font-semibold capitalize">
                        {pres.liveData ? 'Live Data' : 'Static Snapshot'}
                      </span>
                      {pres.accessControl?.isPasswordProtected && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full border border-rose-500/20 bg-rose-500/5 text-rose-400 font-bold flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Locked
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-3 font-semibold">
                      Created: {new Date(pres.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 border-t border-white/5 pt-4">
                    <button
                      onClick={() => window.open(`/presentation/${pres._id}`, '_blank')}
                      className="p-2 rounded-lg bg-[#0d1b2a]/60 text-gold hover:bg-[#0d1b2a] transition cursor-pointer"
                      title="Present in Fullscreen"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => copyShareLink(pres._id)}
                      className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition cursor-pointer relative"
                      title="Copy Public Link"
                    >
                      {copySuccess === pres._id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleEdit(pres)}
                      className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                      title="Edit Configurations"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(pres._id)}
                      className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer ml-auto"
                      title="Delete presentation"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. TAB: DECK CONFIGURATION PARAMETERS */}
      {activeTab === 'new' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass-card p-6 border border-white/10 space-y-6">
            <h2 className="text-xl font-bold text-white border-b border-white/5 pb-2">Presentation Parameters</h2>
            
            {/* Title */}
            <div>
              <label className="text-xs text-gray-400 font-bold uppercase tracking-wider block mb-2">Slide Deck Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. TAKAFUL BOARD PRESENTATION"
                className="w-full bg-[#0d1b2a]/60 border border-white/10 focus:border-gold rounded-xl px-4 py-2.5 text-white focus:outline-none font-bold"
              />
            </div>

            {/* Filter Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400 font-bold uppercase tracking-wider block mb-2">Collection Filter</label>
                <select
                  value={collectionFilter}
                  onChange={e => setCollectionFilter(e.target.value)}
                  className="w-full bg-[#0d1b2a]/60 border border-white/10 focus:border-gold rounded-xl px-3 py-2.5 text-white focus:outline-none font-semibold"
                >
                  <option value="all">All Collections</option>
                  <option value="pro">PRO Collection</option>
                  <option value="ofc">Office Collection</option>
                  <option value="glb">Global Collection</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-400 font-bold uppercase tracking-wider block mb-2">Period Type</label>
                <select
                  value={periodType}
                  onChange={e => setPeriodType(e.target.value)}
                  className="w-full bg-[#0d1b2a]/60 border border-white/10 focus:border-gold rounded-xl px-3 py-2.5 text-white focus:outline-none font-semibold"
                >
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                  <option value="financialYear">Financial Year</option>
                  <option value="custom">Custom Date Range</option>
                </select>
              </div>
            </div>

            {/* Sub-Filters based on period */}
            {periodType === 'custom' ? (
              <div className="grid grid-cols-2 gap-4 bg-white/[0.01] p-4 rounded-xl border border-white/5">
                <div>
                  <label className="text-xs text-gray-500 font-bold uppercase tracking-wider block mb-1">Start Date</label>
                  <input
                    type="date"
                    value={customRange.startDate}
                    onChange={e => setCustomRange(p => ({ ...p, startDate: e.target.value }))}
                    className="w-full bg-[#0d1b2a]/60 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-bold uppercase tracking-wider block mb-1">End Date</label>
                  <input
                    type="date"
                    value={customRange.endDate}
                    onChange={e => setCustomRange(p => ({ ...p, endDate: e.target.value }))}
                    className="w-full bg-[#0d1b2a]/60 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 bg-white/[0.01] p-4 rounded-xl border border-white/5">
                <div>
                  <label className="text-xs text-gray-500 font-bold uppercase tracking-wider block mb-1">Financial Year</label>
                  <select
                    value={fySelection}
                    onChange={e => setFySelection(e.target.value)}
                    className="w-full bg-[#0d1b2a]/60 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none font-semibold"
                  >
                    <option value="all">All Years</option>
                    {financialYears.filter(fy => fy._id !== 'all').map(fy => (
                      <option key={fy._id} value={fy._id}>{fy.year}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-500 font-bold uppercase tracking-wider block mb-1">Limit Module Category</label>
                  <select
                    value={moduleSelection}
                    onChange={e => setModuleSelection(e.target.value)}
                    className="w-full bg-[#0d1b2a]/60 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none font-semibold"
                  >
                    <option value="all">All Modules</option>
                    {modules.filter(m => m._id !== 'all').map(m => (
                      <option key={m._id} value={m._id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Static vs Live Toggle */}
            <div className="flex items-center justify-between p-4 bg-[#0d1b2a]/30 border border-white/10 rounded-xl">
              <div>
                <h4 className="font-bold text-white text-sm">Live Data updates</h4>
                <p className="text-xs text-gray-500 mt-0.5">Toggle Static Snapshot (save data now) vs Live Data Presentation</p>
              </div>
              <button
                onClick={() => setLiveData(!liveData)}
                className={`w-12 h-7 rounded-full transition-colors flex items-center px-1 cursor-pointer ${liveData ? 'bg-gold' : 'bg-white/10'}`}
              >
                <span className={`w-5 h-5 rounded-full bg-white transition-transform ${liveData ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          {/* Access Control Box */}
          <div className="glass-card p-6 border border-white/10 space-y-6">
            <h3 className="text-lg font-bold text-white border-b border-white/5 pb-2">Access Control</h3>
            
            <div className="space-y-4">
              {/* Public Link toggle */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300 font-semibold">Enable Shared Public Link</span>
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={e => setIsPublic(e.target.checked)}
                  className="w-4 h-4 border-white/10 accent-gold rounded"
                />
              </div>

              {/* Password protected toggle */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300 font-semibold">Require Password</span>
                <input
                  type="checkbox"
                  checked={isPasswordProtected}
                  onChange={e => setIsPasswordProtected(e.target.checked)}
                  className="w-4 h-4 border-white/10 accent-gold rounded"
                />
              </div>

              {/* Password field */}
              {isPasswordProtected && (
                <div className="space-y-1.5 animate-fadeIn">
                  <label className="text-[10px] text-gray-500 font-bold uppercase block">Access Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter slides password"
                    className="w-full bg-[#0d1b2a]/60 border border-white/10 focus:border-gold rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
              )}

              {/* Expiration date */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-500 font-bold uppercase block">Expiration Date (Optional)</label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={e => setExpiresAt(e.target.value)}
                  className="w-full bg-[#0d1b2a]/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>
            </div>

            <button
              onClick={() => { handleCompilePreview(); setActiveTab('slides'); }}
              className="w-full py-3 bg-gradient-to-r from-gold to-gold-accent text-dark-bg font-bold rounded-xl shadow-md hover:scale-[1.01] active:scale-[0.99] transition cursor-pointer text-center text-sm"
            >
              Continue to Slides
            </button>
          </div>
        </div>
      )}

      {/* 3. TAB: SLIDES CUSTOMIZER & REORDERING */}
      {activeTab === 'slides' && (
        <div className="glass-card p-6 border border-white/10 space-y-6">
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <h2 className="text-xl font-bold text-white">Enable and Order Slides</h2>
            <span className="text-xs text-gray-500 font-bold">{slides.filter(s => s.enabled).length} of {slides.length} slides enabled</span>
          </div>

          <div className="space-y-3">
            {slides.map((slide, idx) => (
              <div key={slide.id} className={`flex items-center gap-4 bg-white/[0.01] border p-4 rounded-2xl transition ${slide.enabled ? 'border-white/10' : 'border-white/5 opacity-50'}`}>
                {/* Switch enable */}
                <input
                  type="checkbox"
                  checked={slide.enabled}
                  onChange={e => {
                    const newSlides = [...slides];
                    newSlides[idx].enabled = e.target.checked;
                    setSlides(newSlides);
                  }}
                  className="w-4 h-4 accent-gold"
                />

                {/* Index / Number */}
                <span className="text-sm font-bold text-gold min-w-[20px]">{idx + 1}.</span>

                {/* Slide title customize input */}
                <input
                  type="text"
                  value={slide.title}
                  onChange={e => {
                    const newSlides = [...slides];
                    newSlides[idx].title = e.target.value;
                    setSlides(newSlides);
                  }}
                  disabled={!slide.enabled}
                  className="bg-[#0d1b2a]/60 border border-white/10 focus:border-gold rounded-xl px-3 py-2 text-sm text-white focus:outline-none flex-1 max-w-sm disabled:opacity-50"
                />

                <span className="text-xs text-gray-600 font-semibold capitalize hidden sm:inline-block">({slide.id.replace('_', ' ')})</span>

                {/* Up/Down buttons */}
                <div className="flex items-center gap-1 ml-auto">
                  <button
                    disabled={idx === 0}
                    onClick={() => moveSlide(idx, 'up')}
                    className="p-2 bg-white/5 hover:bg-white/10 disabled:opacity-30 rounded-lg text-gray-400 hover:text-white cursor-pointer"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    disabled={idx === slides.length - 1}
                    onClick={() => moveSlide(idx, 'down')}
                    className="p-2 bg-white/5 hover:bg-white/10 disabled:opacity-30 rounded-lg text-gray-400 hover:text-white cursor-pointer"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
            <button
              onClick={() => setActiveTab('new')}
              className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 rounded-xl font-bold cursor-pointer"
            >
              Back
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2.5 bg-gradient-to-r from-gold to-gold-accent text-dark-bg font-extrabold rounded-xl shadow-md cursor-pointer flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> Save slideshow
            </button>
            <button
              onClick={() => { handleCompilePreview(); setActiveTab('preview'); }}
              className="px-5 py-2.5 bg-[#0d1b2a] hover:bg-[#13283f] text-gold border border-gold/30 rounded-xl font-extrabold cursor-pointer"
            >
              Preview & Export
            </button>
          </div>
        </div>
      )}

      {/* 4. TAB: PREVIEW & EXPORT CANVAS */}
      {activeTab === 'preview' && (
        <div className="space-y-6">
          {/* Action Header */}
          <div className="glass-card p-5 border border-white/10 flex flex-wrap justify-between items-center gap-4">
            <div>
              <h3 className="font-bold text-white text-base">Export Slide Deck</h3>
              <p className="text-xs text-gray-400">Generate PDF, PowerPoint files or test the Interactive Fullscreen presentation</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={exportPDF}
                disabled={exporting || compiling}
                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold text-gray-200 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Download className="w-4 h-4 text-gold" /> {exporting ? 'Exporting...' : 'Export PDF'}
              </button>
              <button
                onClick={exportPPTX}
                disabled={exporting || compiling}
                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold text-gray-200 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Download className="w-4 h-4 text-gold" /> {exporting ? 'Exporting...' : 'Export PPTX'}
              </button>
              {selectedPresId && (
                <button
                  onClick={() => window.open(`/presentation/${selectedPresId}`, '_blank')}
                  className="px-4 py-2.5 bg-gradient-to-r from-gold to-gold-accent text-dark-bg font-extrabold rounded-xl text-sm hover:shadow-lg transition cursor-pointer flex items-center gap-2"
                >
                  <Play className="w-4 h-4" /> Present Mode
                </button>
              )}
            </div>
          </div>

          {/* Previews Loading */}
          {compiling ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold" />
              <p className="text-gray-400 text-sm font-semibold">Compiling database analytics into slide previews...</p>
            </div>
          ) : !compiledData ? (
            <div className="text-center py-20 text-gray-500 text-sm">
              Please click "Compile Previews" or save configurations to view preview canvas.
            </div>
          ) : (
            <div className="space-y-12">
              <h2 className="text-xl font-bold text-white border-b border-white/5 pb-2">Deck Previews (16:9 ratio)</h2>

              {/* RENDER LIST OF ENABLED SLIDES */}
              {slides.filter(s => s.enabled).map((slide, idx) => (
                <div key={slide.id} className="space-y-3">
                  <div className="flex justify-between items-center px-2">
                    <span className="text-sm font-bold text-gold">Slide #{idx + 1}: {slide.title}</span>
                  </div>

                  {/* Landscape Aspect Ratio Container */}
                  <div className="w-full overflow-hidden rounded-2xl border border-white/15 bg-slate-950 flex justify-center">
                    <div
                      id={`slide-render-${slide.id}`}
                      className="aspect-[16/9] w-full max-w-[960px] bg-gradient-to-b from-[#0a1128] to-[#040814] p-8 flex flex-col justify-between text-white relative select-none"
                    >
                      {/* Slide Header */}
                      <div className="flex justify-between items-start border-b border-gold/20 pb-3">
                        <div>
                          <h2 className="text-xl font-extrabold text-gold tracking-tight uppercase">{slide.title}</h2>
                          <p className="text-[10px] text-gray-400 mt-0.5">TAKAFUL FOUNDATION REPORT</p>
                        </div>
                        <span className="text-xs text-gray-500 font-bold uppercase">{collectionFilter === 'all' ? 'All Collections' : `${collectionFilter} Filter`}</span>
                      </div>

                      {/* Slide Body */}
                      <div className="flex-1 my-4 flex items-center justify-center overflow-hidden">
                        
                        {/* 1. COVER PAGE */}
                        {slide.id === 'cover' && (
                          <div className="text-center space-y-3 py-6">
                            <Sparkles className="w-12 h-12 text-gold mx-auto animate-pulse" />
                            <h1 className="text-3xl font-extrabold tracking-widest text-white uppercase">{title}</h1>
                            <p className="text-sm text-gold font-bold tracking-widest uppercase">{periodType === 'custom' ? 'Custom Range' : `FY ${compiledData.kpis.fyLabel || 'Period'}`}</p>
                            <div className="w-24 h-0.5 bg-gold mx-auto my-3" />
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Takaful Management Information Systems</p>
                          </div>
                        )}

                        {/* 2. EXECUTIVE SUMMARY */}
                        {slide.id === 'summary' && (
                          <div className="grid grid-cols-3 gap-6 w-full text-center">
                            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                              <span className="text-[10px] text-gray-400 block font-bold uppercase">Total Collection</span>
                              <span className="text-xl font-extrabold text-gold block mt-2">{formatRupee(compiledData.kpis.totalCollection)}</span>
                              <span className="text-[10px] text-emerald-400 mt-1 block">+{compiledData.kpis.growthPct}% vs Last FY</span>
                            </div>
                            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                              <span className="text-[10px] text-gray-400 block font-bold uppercase">Total Sponsors</span>
                              <span className="text-xl font-extrabold text-gold block mt-2">{compiledData.kpis.totalSponsors}</span>
                              <span className="text-[10px] text-gray-500 mt-1 block">{compiledData.kpis.premiumCount} Premium Tiers</span>
                            </div>
                            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                              <span className="text-[10px] text-gray-400 block font-bold uppercase">Active recruiters</span>
                              <span className="text-xl font-extrabold text-gold block mt-2">{compiledData.kpis.activePros} Officers</span>
                              <span className="text-[10px] text-emerald-400 mt-1 block">{compiledData.kpis.contributingPros} Active</span>
                            </div>
                          </div>
                        )}

                        {/* 3. COLLECTION SUMMARY */}
                        {slide.id === 'coll_summary' && (
                          <div className="grid grid-cols-2 gap-6 w-full items-center">
                            <div className="space-y-4">
                              <h4 className="text-xs text-gray-400 font-bold uppercase">Breakdown Metrics</h4>
                              <div className="space-y-2.5">
                                {compiledData.categoryShare.map(c => (
                                  <div key={c.name} className="flex justify-between items-center text-sm border-b border-white/5 pb-1.5">
                                    <span className="text-gray-300 font-semibold">{c.name}</span>
                                    <span className="font-extrabold text-white">{formatRupee(c.value)} ({c.pct}%)</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl text-center">
                              <span className="text-xs text-gray-400 block font-bold uppercase">Total Compiled Takaful Collection</span>
                              <span className="text-2xl font-extrabold text-gold block mt-2">{formatRupee(compiledData.kpis.totalCollection)}</span>
                              <span className="text-xs text-gray-500 block mt-2">{compiledData.kpis.contributingPros} active recruiters submitted</span>
                            </div>
                          </div>
                        )}

                        {/* 4. CATEGORY DETAILS */}
                        {slide.id === 'cat_details' && (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="w-[300px] h-[220px]">
                              <EChartWrapper option={getCategoryShareOption()} />
                            </div>
                            <div className="flex-1 grid grid-cols-2 gap-4 text-xs ml-8">
                              {compiledData.categoryShare.map(c => (
                                <div key={c.name} className="p-2.5 bg-white/[0.01] border border-white/5 rounded-xl flex items-center gap-3">
                                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                                  <div>
                                    <div className="font-bold text-white">{c.name}</div>
                                    <div className="text-gold font-bold">{formatRupee(c.value)} ({c.pct}%)</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 5. TOP CONTRIBUTORS */}
                        {slide.id === 'top_contributors' && (
                          <div className="w-full space-y-4">
                            <h4 className="text-xs text-gray-400 font-bold uppercase">Top 5 Performing Officers</h4>
                            <div className="grid grid-cols-5 gap-3">
                              {compiledData.topContributors.map((c, idx) => (
                                <div key={c.proId} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-center flex flex-col justify-between">
                                  <div>
                                    <span className="text-xs font-bold text-gold block">#{idx+1}</span>
                                    <div className="font-bold text-white text-xs mt-1 truncate">{c.name}</div>
                                    <span className="text-[9px] text-gray-500 block mt-0.5 truncate">{c.designation || 'PRO Officer'}</span>
                                  </div>
                                  <span className="text-xs font-extrabold text-gold block mt-3">{formatRupee(c.total)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 6. SPONSOR SUMMARY */}
                        {slide.id === 'sponsor_summary' && (
                          <div className="grid grid-cols-4 gap-4 w-full text-center">
                            <div className="p-3 bg-[#0d1b2a]/40 border border-white/10 rounded-xl">
                              <span className="text-[10px] text-gray-400 block font-semibold uppercase">Total Sponsors</span>
                              <span className="text-2xl font-extrabold text-gold block mt-2">{compiledData.kpis.totalSponsors}</span>
                              <span className="text-[9px] text-gray-500 mt-1 block">Active recurring</span>
                            </div>
                            <div className="p-3 bg-white/[0.01] border border-white/5 rounded-xl">
                              <span className="text-[10px] text-gray-400 block font-semibold uppercase">Premium Tier</span>
                              <span className="text-xl font-extrabold text-white block mt-2">{compiledData.kpis.premiumCount}</span>
                              <span className="text-[9px] text-gold mt-1 block">High tier sponsors</span>
                            </div>
                            <div className="p-3 bg-white/[0.01] border border-white/5 rounded-xl">
                              <span className="text-[10px] text-gray-400 block font-semibold uppercase">Smart Tier</span>
                              <span className="text-xl font-extrabold text-white block mt-2">{compiledData.kpis.smartCount}</span>
                              <span className="text-[9px] text-gold mt-1 block">Medium tier</span>
                            </div>
                            <div className="p-3 bg-white/[0.01] border border-white/5 rounded-xl">
                              <span className="text-[10px] text-gray-400 block font-semibold uppercase">Standard Tier</span>
                              <span className="text-xl font-extrabold text-white block mt-2">{compiledData.kpis.standardCount}</span>
                              <span className="text-[9px] text-gold mt-1 block">Base sponsors</span>
                            </div>
                          </div>
                        )}

                        {/* 7. SPONSOR RANKINGS */}
                        {slide.id === 'sponsor_rankings' && (
                          <div className="w-full space-y-3">
                            <h4 className="text-xs text-gray-400 font-bold uppercase">Sponsor Recruiters Leaderboard</h4>
                            <div className="grid grid-cols-2 gap-4">
                              {compiledData.sponsorRankings.slice(0, 4).map((r, idx) => (
                                <div key={r.proId} className="flex justify-between items-center p-3 bg-white/[0.01] border border-white/5 rounded-xl text-xs">
                                  <div className="flex items-center gap-3">
                                    <span className="font-bold text-gold">#{idx+1}</span>
                                    <div>
                                      <div className="font-bold text-white">{r.name}</div>
                                      <div className="text-[10px] text-gray-500">{r.designation || 'PRO Officer'} — {r.category}</div>
                                    </div>
                                  </div>
                                  <span className="font-extrabold text-gold">{r.total} Sponsors</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 8. DISTRIBUTION ANALYSIS */}
                        {slide.id === 'dist_analysis' && (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="w-[300px] h-[220px]">
                              <EChartWrapper option={getDistributionOption()} />
                            </div>
                            <div className="flex-1 space-y-2 ml-8 text-xs max-h-[220px] overflow-y-auto no-scrollbar">
                              {compiledData.distributionAnalysis.map((d, idx) => (
                                <div key={d.name} className="flex justify-between items-center border-b border-white/5 pb-1.5">
                                  <span className="text-gray-300 font-semibold">{d.name}</span>
                                  <span className="font-bold text-white">{formatRupee(d.value)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 9. MONTHLY COMPARISON */}
                        {slide.id === 'monthly_comparison' && (
                          <div className="w-full h-[220px]">
                            <EChartWrapper option={getCollectionTrendOption()} />
                          </div>
                        )}

                        {/* 10. ANNUAL COMPARISON */}
                        {slide.id === 'annual_comparison' && (
                          <div className="grid grid-cols-2 gap-6 w-full items-center text-center">
                            <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
                              <span className="text-xs text-gray-400 block font-bold uppercase">Current FY Collection</span>
                              <span className="text-3xl font-extrabold text-gold block mt-2">{formatRupee(compiledData.kpis.totalCollection)}</span>
                              <span className="text-xs text-gray-500 mt-2 block">Active target scope</span>
                            </div>
                            <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
                              <span className="text-xs text-gray-400 block font-bold uppercase">Previous FY Collection</span>
                              <span className="text-3xl font-extrabold text-white block mt-2">{formatRupee(compiledData.kpis.prevCollection)}</span>
                              <span className="text-xs text-emerald-400 mt-2 block">Growth: +{compiledData.kpis.growthPct}%</span>
                            </div>
                          </div>
                        )}

                        {/* 11. GROWTH TRENDS */}
                        {slide.id === 'growth_trends' && (
                          <div className="w-full h-[220px]">
                            <EChartWrapper option={getSponsorGrowthOption()} />
                          </div>
                        )}

                        {/* 12. AI INSIGHTS */}
                        {slide.id === 'ai_insights' && (
                          <div className="w-full text-left space-y-3.5 pl-6">
                            {compiledData.insights.map((ins, index) => (
                              <div key={index} className="flex items-start gap-3">
                                <span className="w-2.5 h-2.5 rounded-full bg-gold shrink-0 mt-1" />
                                <p className="text-sm font-semibold text-gray-200">{ins}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* 13. PRO DETAIL */}
                        {slide.id === 'pro_detail' && (
                          <div className="w-full overflow-y-auto max-h-[220px] no-scrollbar border border-white/10 rounded-xl">
                            <table className="w-full text-left text-[11px]">
                              <thead>
                                <tr className="bg-white/5 text-gray-400 uppercase font-bold border-b border-white/10">
                                  <th className="px-4 py-2">Rank</th>
                                  <th className="px-4 py-2">Recruiter</th>
                                  <th className="px-4 py-2 text-right">Takaful</th>
                                  <th className="px-4 py-2 text-right">Additional</th>
                                  <th className="px-4 py-2 text-right text-gold">Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5">
                                {compiledData.recruiterRankings.slice(0, 10).map((r) => (
                                  <tr key={r.proId} className="text-gray-300">
                                    <td className="px-4 py-1.5 font-bold text-gold">#{r.rank}</td>
                                    <td className="px-4 py-1.5 font-semibold text-white truncate max-w-[120px]">{r.name}</td>
                                    <td className="px-4 py-1.5 text-right">{formatRupee(r.takaful)}</td>
                                    <td className="px-4 py-1.5 text-right">{formatRupee(r.additional)}</td>
                                    <td className="px-4 py-1.5 text-right font-bold text-gold">{formatRupee(r.total)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* 14. DIRECT COLLECTIONS */}
                        {slide.id === 'direct_cols' && (
                          <div className="w-full overflow-y-auto max-h-[220px] no-scrollbar border border-white/10 rounded-xl">
                            <table className="w-full text-left text-[11px]">
                              <thead>
                                <tr className="bg-white/5 text-gray-400 uppercase font-bold border-b border-white/10">
                                  <th className="px-4 py-2">Recruiter</th>
                                  {compiledData.directCollectionHeads.map(head => (
                                    <th key={head} className="px-4 py-2 text-right">{head}</th>
                                  ))}
                                  <th className="px-4 py-2 text-right text-gold">Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5">
                                {compiledData.directCollections.slice(0, 10).map((r, idx) => (
                                  <tr key={idx} className="text-gray-300">
                                    <td className="px-4 py-1.5 font-semibold text-white truncate max-w-[120px]">{r.proName}</td>
                                    {compiledData.directCollectionHeads.map(head => (
                                      <td key={head} className="px-4 py-1.5 text-right">{formatRupee(r.headAmounts[head])}</td>
                                    ))}
                                    <td className="px-4 py-1.5 text-right font-bold text-gold">{formatRupee(r.totalAmount)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* 15. CLOSING SLIDE */}
                        {slide.id === 'closing' && (
                          <div className="text-center space-y-3 py-6">
                            <h2 className="text-3xl font-extrabold text-gold tracking-widest uppercase">THANK YOU</h2>
                            <p className="text-sm text-gray-300">For your support and dedication to Takaful initiatives.</p>
                            <div className="w-16 h-0.5 bg-gold mx-auto my-3" />
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Takaful Foundation — Board of Directors</p>
                          </div>
                        )}

                      </div>

                      {/* Slide Footer */}
                      <div className="flex justify-between items-center border-t border-white/5 pt-2 text-[9px] text-gray-500">
                        <span>Report Period: {periodType === 'custom' ? `${customRange.startDate} to ${customRange.endDate}` : `FY ${compiledData.kpis.fyLabel || 'N/A'}`}</span>
                        <span>Page {idx + 1} of {slides.filter(s => s.enabled).length}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
            <button
              onClick={() => setActiveTab('slides')}
              className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 rounded-xl font-bold cursor-pointer"
            >
              Back
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2.5 bg-gradient-to-r from-gold to-gold-accent text-dark-bg font-extrabold rounded-xl shadow-md cursor-pointer flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> Save Deck
            </button>
          </div>
        </div>
      )}

      {/* Offscreen Deck Render wrapper for background canvas capture */}
      <div className="absolute top-[-9999px] left-[-9999px]" id="offscreen-deck-container">
        {compiledData && slides.filter(s => s.enabled).map((slide, idx) => (
          <div
            key={`offscreen-${slide.id}`}
            id={`slide-render-${slide.id}`}
            className="w-[960px] h-[540px] bg-gradient-to-b from-[#0a1128] to-[#040814] p-8 flex flex-col justify-between text-white relative select-none"
            style={{ fontFamily: 'system-ui, sans-serif' }}
          >
            {/* Slide Header */}
            <div className="flex justify-between items-start border-b border-gold/20 pb-3">
              <div>
                <h2 className="text-xl font-extrabold text-gold tracking-tight uppercase" style={{ margin: 0 }}>{slide.title}</h2>
                <p className="text-[10px] text-gray-400 mt-0.5" style={{ margin: 0 }}>TAKAFUL FOUNDATION REPORT</p>
              </div>
              <span className="text-xs text-gray-500 font-bold uppercase">{collectionFilter === 'all' ? 'All Collections' : `${collectionFilter} Filter`}</span>
            </div>

            {/* Slide Body */}
            <div className="flex-1 my-4 flex items-center justify-center overflow-hidden">
              
              {/* 1. COVER PAGE */}
              {slide.id === 'cover' && (
                <div className="text-center py-6" style={{ width: '100%' }}>
                  <h1 className="text-3xl font-extrabold tracking-widest text-white uppercase" style={{ margin: '0 0 10px 0' }}>{title}</h1>
                  <p className="text-sm text-gold font-bold tracking-widest uppercase" style={{ margin: 0 }}>{periodType === 'custom' ? 'Custom Range' : `FY ${compiledData.kpis.fyLabel || 'Period'}`}</p>
                  <div className="w-24 h-0.5 bg-gold mx-auto my-3" />
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest" style={{ margin: 0 }}>Takaful Management Information Systems</p>
                </div>
              )}

              {/* 2. EXECUTIVE SUMMARY */}
              {slide.id === 'summary' && (
                <div className="grid grid-cols-3 gap-6 w-full text-center">
                  <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                    <span className="text-[10px] text-gray-400 block font-bold uppercase">Total Collection</span>
                    <span className="text-xl font-extrabold text-gold block mt-2">{formatRupee(compiledData.kpis.totalCollection)}</span>
                    <span className="text-[10px] text-emerald-400 mt-1 block">+{compiledData.kpis.growthPct}% vs Last FY</span>
                  </div>
                  <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                    <span className="text-[10px] text-gray-400 block font-bold uppercase">Total Sponsors</span>
                    <span className="text-xl font-extrabold text-gold block mt-2">{compiledData.kpis.totalSponsors}</span>
                    <span className="text-[10px] text-gray-500 mt-1 block">{compiledData.kpis.premiumCount} Premium Tiers</span>
                  </div>
                  <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                    <span className="text-[10px] text-gray-400 block font-bold uppercase">Active recruiters</span>
                    <span className="text-xl font-extrabold text-gold block mt-2">{compiledData.kpis.activePros} Officers</span>
                    <span className="text-[10px] text-emerald-400 mt-1 block">{compiledData.kpis.contributingPros} Active</span>
                  </div>
                </div>
              )}

              {/* 3. COLLECTION SUMMARY */}
              {slide.id === 'coll_summary' && (
                <div className="grid grid-cols-2 gap-6 w-full items-center">
                  <div className="space-y-4">
                    <h4 className="text-xs text-gray-400 font-bold uppercase">Breakdown Metrics</h4>
                    <div className="space-y-2.5">
                      {compiledData.categoryShare.map(c => (
                        <div key={c.name} className="flex justify-between items-center text-sm border-b border-white/5 pb-1.5">
                          <span className="text-gray-300 font-semibold">{c.name}</span>
                          <span className="font-extrabold text-white">{formatRupee(c.value)} ({c.pct}%)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl text-center">
                    <span className="text-xs text-gray-400 block font-bold uppercase">Total Compiled Takaful Collection</span>
                    <span className="text-2xl font-extrabold text-gold block mt-2">{formatRupee(compiledData.kpis.totalCollection)}</span>
                    <span className="text-xs text-gray-500 block mt-2">{compiledData.kpis.contributingPros} active recruiters submitted</span>
                  </div>
                </div>
              )}

              {/* 4. CATEGORY DETAILS */}
              {slide.id === 'cat_details' && (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-[300px] h-[220px]">
                    <EChartWrapper option={getCategoryShareOption()} />
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-4 text-xs ml-8">
                    {compiledData.categoryShare.map(c => (
                      <div key={c.name} className="p-2.5 bg-white/[0.01] border border-white/5 rounded-xl flex items-center gap-3">
                        <span className="w-2.5 h-2.5 rounded-full shadow" style={{ backgroundColor: c.color }} />
                        <div>
                          <div className="font-bold text-white">{c.name}</div>
                          <div className="text-gold font-bold">{formatRupee(c.value)} ({c.pct}%)</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 5. TOP CONTRIBUTORS */}
              {slide.id === 'top_contributors' && (
                <div className="w-full space-y-4">
                  <h4 className="text-xs text-gray-400 font-bold uppercase">Top 5 Performing Officers</h4>
                  <div className="grid grid-cols-5 gap-3">
                    {compiledData.topContributors.map((c, idx) => (
                      <div key={c.proId} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-center flex flex-col justify-between">
                        <div>
                          <span className="text-xs font-bold text-gold block">#{idx+1}</span>
                          <div className="font-bold text-white text-xs mt-1 truncate">{c.name}</div>
                          <span className="text-[9px] text-gray-500 block mt-0.5 truncate">{c.designation || 'PRO Officer'}</span>
                        </div>
                        <span className="text-xs font-extrabold text-gold block mt-3">{formatRupee(c.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 6. SPONSOR SUMMARY */}
              {slide.id === 'sponsor_summary' && (
                <div className="grid grid-cols-4 gap-4 w-full text-center">
                  <div className="p-3 bg-[#0d1b2a]/40 border border-white/10 rounded-xl">
                    <span className="text-[10px] text-gray-400 block font-semibold uppercase">Total Sponsors</span>
                    <span className="text-2xl font-extrabold text-gold block mt-2">{compiledData.kpis.totalSponsors}</span>
                    <span className="text-[9px] text-gray-500 mt-1 block">Active recurring</span>
                  </div>
                  <div className="p-3 bg-white/[0.01] border border-white/5 rounded-xl">
                    <span className="text-[10px] text-gray-400 block font-semibold uppercase">Premium Tier</span>
                    <span className="text-xl font-extrabold text-white block mt-2">{compiledData.kpis.premiumCount}</span>
                    <span className="text-[9px] text-gold mt-1 block">High tier sponsors</span>
                  </div>
                  <div className="p-3 bg-white/[0.01] border border-white/5 rounded-xl">
                    <span className="text-[10px] text-gray-400 block font-semibold uppercase">Smart Tier</span>
                    <span className="text-xl font-extrabold text-white block mt-2">{compiledData.kpis.smartCount}</span>
                    <span className="text-[9px] text-gold mt-1 block">Medium tier</span>
                  </div>
                  <div className="p-3 bg-white/[0.01] border border-white/5 rounded-xl">
                    <span className="text-[10px] text-gray-400 block font-semibold uppercase">Standard Tier</span>
                    <span className="text-xl font-extrabold text-white block mt-2">{compiledData.kpis.standardCount}</span>
                    <span className="text-[9px] text-gold mt-1 block">Base sponsors</span>
                  </div>
                </div>
              )}

              {/* 7. SPONSOR RANKINGS */}
              {slide.id === 'sponsor_rankings' && (
                <div className="w-full space-y-3">
                  <h4 className="text-xs text-gray-400 font-bold uppercase">Sponsor Recruiters Leaderboard</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {compiledData.sponsorRankings.slice(0, 4).map((r, idx) => (
                      <div key={r.proId} className="flex justify-between items-center p-3 bg-white/[0.01] border border-white/5 rounded-xl text-xs">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-gold">#{idx+1}</span>
                          <div>
                            <div className="font-bold text-white">{r.name}</div>
                            <div className="text-[10px] text-gray-500">{r.designation || 'PRO Officer'} — {r.category}</div>
                          </div>
                        </div>
                        <span className="font-extrabold text-gold">{r.total} Sponsors</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 8. DISTRIBUTION ANALYSIS */}
              {slide.id === 'dist_analysis' && (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-[300px] h-[220px]">
                    <EChartWrapper option={getDistributionOption()} />
                  </div>
                  <div className="flex-1 space-y-2 ml-8 text-xs max-h-[220px] overflow-y-auto no-scrollbar">
                    {compiledData.distributionAnalysis.map((d, idx) => (
                      <div key={d.name} className="flex justify-between items-center border-b border-white/5 pb-1.5">
                        <span className="text-gray-300 font-semibold">{d.name}</span>
                        <span className="font-bold text-white">{formatRupee(d.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 9. MONTHLY COMPARISON */}
              {slide.id === 'monthly_comparison' && (
                <div className="w-full h-[220px]">
                  <EChartWrapper option={getCollectionTrendOption()} />
                </div>
              )}

              {/* 10. ANNUAL COMPARISON */}
              {slide.id === 'annual_comparison' && (
                <div className="grid grid-cols-2 gap-6 w-full items-center text-center">
                  <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
                    <span className="text-xs text-gray-400 block font-bold uppercase">Current FY Collection</span>
                    <span className="text-3xl font-extrabold text-gold block mt-2">{formatRupee(compiledData.kpis.totalCollection)}</span>
                    <span className="text-xs text-gray-500 mt-2 block">Active target scope</span>
                  </div>
                  <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
                    <span className="text-xs text-gray-400 block font-bold uppercase">Previous FY Collection</span>
                    <span className="text-3xl font-extrabold text-white block mt-2">{formatRupee(compiledData.kpis.prevCollection)}</span>
                    <span className="text-xs text-emerald-400 mt-2 block">Growth: +{compiledData.kpis.growthPct}%</span>
                  </div>
                </div>
              )}

              {/* 11. GROWTH TRENDS */}
              {slide.id === 'growth_trends' && (
                <div className="w-full h-[220px]">
                  <EChartWrapper option={getSponsorGrowthOption()} />
                </div>
              )}

              {/* 12. AI INSIGHTS */}
              {slide.id === 'ai_insights' && (
                <div className="w-full text-left space-y-3.5 pl-6">
                  {compiledData.insights.map((ins, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-gold shrink-0 mt-1" />
                      <p className="text-sm font-semibold text-gray-200">{ins}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* 13. PRO DETAIL */}
              {slide.id === 'pro_detail' && (
                <div className="w-full border border-white/10 rounded-xl">
                  <table className="w-full text-left text-[11px]">
                    <thead>
                      <tr className="bg-white/5 text-gray-400 uppercase font-bold border-b border-white/10">
                        <th className="px-4 py-2">Rank</th>
                        <th className="px-4 py-2">Recruiter</th>
                        <th className="px-4 py-2 text-right">Takaful</th>
                        <th className="px-4 py-2 text-right">Additional</th>
                        <th className="px-4 py-2 text-right text-gold">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {compiledData.recruiterRankings.slice(0, 10).map((r) => (
                        <tr key={r.proId} className="text-gray-300">
                          <td className="px-4 py-1.5 font-bold text-gold">#{r.rank}</td>
                          <td className="px-4 py-1.5 font-semibold text-white truncate max-w-[120px]">{r.name}</td>
                          <td className="px-4 py-1.5 text-right">{formatRupee(r.takaful)}</td>
                          <td className="px-4 py-1.5 text-right">{formatRupee(r.additional)}</td>
                          <td className="px-4 py-1.5 text-right font-bold text-gold">{formatRupee(r.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 14. DIRECT COLLECTIONS */}
              {slide.id === 'direct_cols' && (
                <div className="w-full border border-white/10 rounded-xl">
                  <table className="w-full text-left text-[11px]">
                    <thead>
                      <tr className="bg-white/5 text-gray-400 uppercase font-bold border-b border-white/10">
                        <th className="px-4 py-2">Recruiter</th>
                        {compiledData.directCollectionHeads.map(head => (
                          <th key={head} className="px-4 py-2 text-right">{head}</th>
                        ))}
                        <th className="px-4 py-2 text-right text-gold">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {compiledData.directCollections.slice(0, 10).map((r, idx) => (
                        <tr key={idx} className="text-gray-300">
                          <td className="px-4 py-1.5 font-semibold text-white truncate max-w-[120px]">{r.proName}</td>
                          {compiledData.directCollectionHeads.map(head => (
                            <td key={head} className="px-4 py-1.5 text-right">{formatRupee(r.headAmounts[head])}</td>
                          ))}
                          <td className="px-4 py-1.5 text-right font-bold text-gold">{formatRupee(r.totalAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 15. CLOSING SLIDE */}
              {slide.id === 'closing' && (
                <div className="text-center py-6" style={{ width: '100%' }}>
                  <h2 className="text-3xl font-extrabold text-gold tracking-widest uppercase" style={{ margin: '0 0 10px 0' }}>THANK YOU</h2>
                  <p className="text-sm text-gray-300" style={{ margin: 0 }}>For your support and dedication to Takaful initiatives.</p>
                  <div className="w-16 h-0.5 bg-gold mx-auto my-3" />
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider" style={{ margin: 0 }}>Takaful Foundation — Board of Directors</p>
                </div>
              )}

            </div>

            {/* Slide Footer */}
            <div className="flex justify-between items-center border-t border-white/5 pt-2 text-[9px] text-gray-500">
              <span>Report Period: {periodType === 'custom' ? `${customRange.startDate} to ${customRange.endDate}` : `FY ${compiledData.kpis.fyLabel || 'N/A'}`}</span>
              <span>Page {idx + 1} of {slides.filter(s => s.enabled).length}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PresentationBuilder;
