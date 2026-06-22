import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import client from '../api/client';
import ReactECharts from 'echarts-for-react';
import {
  LineChart,
  Calendar,
  Users,
  Download,
  TrendingUp,
  TrendingDown,
  Trophy,
  ChevronLeft,
  ChevronRight,
  Search,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Crown,
  ChevronDown,
  Check,
  Percent,
  BarChart3,
  PieChart,
  Layers
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import AnimatedCounter from '../components/AnimatedCounter';
import { ROBOTO_FONT_BASE64 } from '../assets/font';

const MONTHS = [
  'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December', 'January', 'February', 'March'
];

// ─── Category Comparison View ──────────────────────────────────────────────────
const CategoryComparison = ({ selectedFY, selectedModule }) => {
  const [month, setMonth] = useState('All');
  const [catData, setCatData] = useState(null);
  const [loading, setLoading] = useState(true);
  const barRef = useRef(null);
  const pieRef = useRef(null);
  const stackRef = useRef(null);

  const fetchCatData = async () => {
    if (!selectedFY?._id) return;
    setLoading(true);
    try {
      const monthParam = month !== 'All' ? `&month=${month}` : '';
      const res = await client.get(
        `/api/analytics/category-monthly?financialYear=${selectedFY._id}${monthParam}`
      );
      if (res.data.success) setCatData(res.data.data);
    } catch (err) {
      console.error('Failed to load category comparison data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCatData(); }, [selectedFY, month]);

  const nextMonth = () => {
    if (month === 'All') { setMonth(MONTHS[0]); return; }
    const idx = MONTHS.indexOf(month);
    setMonth(idx === MONTHS.length - 1 ? 'All' : MONTHS[idx + 1]);
  };
  const prevMonth = () => {
    if (month === 'All') { setMonth(MONTHS[MONTHS.length - 1]); return; }
    const idx = MONTHS.indexOf(month);
    setMonth(idx === 0 ? 'All' : MONTHS[idx - 1]);
  };

  const exportChartPNG = (ref, name) => {
    if (ref.current) {
      const inst = ref.current.getEchartsInstance();
      const url = inst.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#0a0f1d' });
      const link = document.createElement('a');
      link.href = url;
      link.download = `${name}_${month}_${selectedFY?.year || 'All'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const exportExcel = () => {
    if (!catData) return;
    const wb = XLSX.utils.book_new();
    const summaryData = catData.categoryBreakdown.map(c => ({
      Category: c.name,
      'Amount (₹)': c.value,
      'Contribution %': c.pct
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), 'Category Summary');

    const trendData = catData.monthlyByCategory.map(row => {
      const entry = { Month: row.month };
      catData.modules.forEach(m => { entry[m.name] = row[m.code] || 0; });
      entry['Total'] = row.total || 0;
      return entry;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trendData), 'Monthly Trend');
    XLSX.writeFile(wb, `Category_Comparison_${selectedFY?.year || 'All'}.xlsx`);
  };

  const exportPDF = () => {
    if (!catData) return;
    const doc = new jsPDF();
    doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_FONT_BASE64);
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'bold');
    doc.setFont('Roboto');

    doc.setFontSize(16);
    doc.text(`Collection Categories Comparison — ${selectedFY?.label || 'All Years'}`, 14, 15);
    doc.setFontSize(9);
    doc.text(`Scope: ${month === 'All' ? 'Full Year' : month} | Generated: ${new Date().toLocaleDateString()}`, 14, 22);

    doc.autoTable({
      head: [['Category', 'Amount (₹)', 'Contribution %']],
      body: catData.categoryBreakdown.map(c => [c.name, `₹${c.value.toLocaleString('en-IN')}`, `${c.pct}%`]),
      startY: 28,
      theme: 'grid',
      styles: { fontSize: 9, font: 'Roboto' },
      headStyles: { fillColor: [13, 27, 42], font: 'Roboto' }
    });
    doc.save(`Category_Comparison_${selectedFY?.year || 'All'}.pdf`);
  };

  if (loading || !catData) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold" />
      </div>
    );
  }

  const cats = catData.categoryBreakdown;
  const mods = catData.modules;
  const activeCats = cats.filter(c => c.value > 0);
  const activeMods = mods.filter(mod => {
    const cat = cats.find(c => c.code === mod.code);
    return cat ? cat.value > 0 : false;
  });
  const activeMonthsData = catData.monthlyByCategory.filter(row => row.total > 0);

  // ── Bar Chart ────────────────────────────────────────────────────────────────
  const barOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(10,15,29,0.95)',
      borderColor: 'rgba(245,197,24,0.3)',
      borderWidth: 1,
      textStyle: { color: '#fff', fontSize: 11 },
      formatter: params => {
        const d = params[0];
        return `<div class="p-1"><p class="text-[10px] text-gray-400 font-bold uppercase tracking-wider">${d.name}</p><p class="text-sm font-extrabold text-gold mt-1">₹${d.value.toLocaleString('en-IN')}</p></div>`;
      }
    },
    grid: { left: '4%', right: '4%', bottom: '8%', top: '10%', containLabel: true },
    xAxis: {
      type: 'category',
      data: activeCats.map(c => c.name),
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      axisLabel: { color: '#9ca3af', fontSize: 11 }
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.03)' } },
      axisLabel: { color: '#9ca3af', formatter: v => v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : `₹${v}` }
    },
    series: [{
      type: 'bar',
      barWidth: '45%',
      data: activeCats.map(c => ({
        value: c.value,
        itemStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: c.color },
              { offset: 1, color: c.color + '77' }
            ]
          },
          borderRadius: [8, 8, 0, 0],
          shadowBlur: 12,
          shadowColor: c.color + '44'
        }
      }))
    }]
  };

  // ── Pie Chart ────────────────────────────────────────────────────────────────
  const pieOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(10,15,29,0.95)',
      borderColor: 'rgba(245,197,24,0.3)',
      borderWidth: 1,
      textStyle: { color: '#fff' },
      formatter: p => `<b>${p.name}</b><br/>₹${p.value.toLocaleString('en-IN')} (${p.percent.toFixed(1)}%)`
    },
    legend: { bottom: '4%', left: 'center', textStyle: { color: '#9ca3af', fontSize: 11 } },
    series: [{
      type: 'pie',
      radius: ['45%', '72%'],
      center: ['50%', '46%'],
      padAngle: 3,
      itemStyle: { borderRadius: 10, borderColor: '#0a0f1d', borderWidth: 2 },
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold', formatter: '{b}\n{d}%', color: '#fff' } },
      data: activeCats.map(c => ({ name: c.name, value: c.value, itemStyle: { color: c.color } }))
    }]
  };

  // ── Stacked Monthly Trend ────────────────────────────────────────────────────
  const stackOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(10,15,29,0.95)',
      borderColor: 'rgba(245,197,24,0.3)',
      borderWidth: 1,
      textStyle: { color: '#fff', fontSize: 10 }
    },
    legend: { top: '2%', textStyle: { color: '#9ca3af', fontSize: 10 }, data: activeMods.map(m => m.name) },
    grid: { left: '3%', right: '4%', bottom: '10%', top: '15%', containLabel: true },
    xAxis: {
      type: 'category',
      data: activeMonthsData.map(row => row.month.substring(0, 3)),
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      axisLabel: { color: '#9ca3af', fontSize: 10 }
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.03)' } },
      axisLabel: { color: '#9ca3af', formatter: v => v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v }
    },
    series: activeMods.map(mod => ({
      name: mod.name,
      type: 'bar',
      stack: 'total',
      barWidth: '55%',
      itemStyle: { color: mod.color, borderRadius: [0, 0, 0, 0] },
      emphasis: { focus: 'series' },
      data: activeMonthsData.map(row => row[mod.code] || 0)
    }))
  };

  return (
    <div className="p-6 space-y-6 animate-fadeIn pb-12">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold text-white">
              Collection <span className="gold-gradient-text">Categories</span> Comparison
            </h1>
            {selectedFY?._id === 'all' && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border"
                style={{ color: '#d4af37', borderColor: '#d4af3744', background: '#d4af3718' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#d4af37' }} />
                Scope: All Years
              </span>
            )}
          </div>
          <p className="text-gray-400 text-sm mt-1">
            Compare PRO, Office and Global collection performance by category
          </p>
        </div>
        <div className="flex space-x-3 shrink-0">
          <button onClick={exportExcel}
            className="flex items-center space-x-2 bg-white/5 hover:bg-white/10 text-gold border border-gold/20 hover:border-gold/40 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer">
            <FileSpreadsheet className="w-4 h-4" /><span>Export Excel</span>
          </button>
          <button onClick={exportPDF}
            className="flex items-center space-x-2 bg-gradient-to-r from-gold to-gold-accent hover:from-gold-accent hover:to-gold text-dark-bg px-4 py-2.5 rounded-xl text-xs font-bold transition-all glow-btn cursor-pointer">
            <FileText className="w-4 h-4" /><span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Month Filter Bar */}
      <div className="glass-card rounded-2xl p-5 flex items-center justify-between gap-6">
        <div className="flex items-center space-x-2 bg-[#0a0f1d]/60 border border-white/10 p-1.5 rounded-xl">
          <button onClick={prevMonth} className="p-2 hover:bg-white/5 rounded-lg text-gold transition-colors cursor-pointer">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="w-28 text-center">
            <span className="text-sm font-bold text-white uppercase tracking-wider">{month}</span>
          </div>
          <button onClick={nextMonth} className="p-2 hover:bg-white/5 rounded-lg text-gold transition-colors cursor-pointer">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {['All', ...MONTHS].map(m => (
            <button
              key={m}
              onClick={() => setMonth(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                month === m
                  ? 'bg-gold text-dark-bg'
                  : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {m === 'All' ? 'All Months' : m.substring(0, 3)}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Grand Total */}
        <div className="glass-card rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute right-4 top-4 p-2 bg-white/5 rounded-lg border border-white/5 text-gold">
            <Layers className="w-5 h-5" />
          </div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
            {month === 'All' ? 'Total Collection' : `${month} Total`}
          </p>
          <h3 className="text-3xl font-extrabold text-white mt-2">
            <AnimatedCounter value={catData.grandTotal} formatAsCurrency={true} />
          </h3>
          <p className="text-xs text-gray-500 mt-2">Across all categories</p>
        </div>

        {/* Highest Category */}
        <div className="glass-card rounded-2xl p-6 relative overflow-hidden border-l-4"
          style={{ borderColor: catData.highest?.color || '#d4af37' }}>
          <div className="absolute right-4 top-4 p-2 rounded-lg"
            style={{ background: (catData.highest?.color || '#d4af37') + '20' }}>
            <TrendingUp className="w-5 h-5" style={{ color: catData.highest?.color || '#d4af37' }} />
          </div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">🏆 Highest Category</p>
          <h4 className="text-lg font-bold text-white mt-2 truncate">{catData.highest?.name || '—'}</h4>
          <p className="text-2xl font-extrabold mt-1" style={{ color: catData.highest?.color || '#d4af37' }}>
            ₹{(catData.highest?.value || 0).toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-gray-500 mt-1">{catData.highest?.pct}% contribution</p>
        </div>

        {/* Lowest Category */}
        <div className="glass-card rounded-2xl p-6 relative overflow-hidden border-l-4 border-l-rose-500/50">
          <div className="absolute right-4 top-4 p-2 bg-rose-500/10 rounded-lg">
            <TrendingDown className="w-5 h-5 text-rose-400" />
          </div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">⚠ Lowest Category</p>
          <h4 className="text-lg font-bold text-white mt-2 truncate">{catData.lowest?.name || '—'}</h4>
          <p className="text-2xl font-extrabold text-rose-400 mt-1">
            ₹{(catData.lowest?.value || 0).toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-gray-500 mt-1">{catData.lowest?.pct}% contribution</p>
        </div>

        {/* Active Categories */}
        <div className="glass-card rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute right-4 top-4 p-2 bg-white/5 rounded-lg border border-white/5 text-blue-400">
            <BarChart3 className="w-5 h-5" />
          </div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Categories</p>
          <h3 className="text-3xl font-extrabold text-white mt-2">{cats.filter(c => c.value > 0).length}</h3>
          <p className="text-xs text-gray-500 mt-2">of {cats.length} have collections</p>
        </div>
      </div>

      {/* Category Summary Table + Pie Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Summary Table */}
        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white flex items-center mb-5">
            <Layers className="w-5 h-5 mr-2 text-gold" />
            Category Comparison
          </h3>
          <div className="space-y-3">
            {cats.map((cat, idx) => {
              const pctWidth = catData.grandTotal > 0 ? (cat.value / catData.grandTotal * 100) : 0;
              return (
                <div key={cat.code} className="p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</span>
                      <div>
                        <p className="font-bold text-white text-sm">{cat.name}</p>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">{cat.code}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-extrabold text-base" style={{ color: cat.color }}>
                        ₹{cat.value.toLocaleString('en-IN')}
                      </p>
                      <p className="text-xs text-gray-400">{cat.pct}%</p>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-white/5 rounded-full h-1.5 mt-2">
                    <div
                      className="h-1.5 rounded-full transition-all duration-700"
                      style={{ width: `${pctWidth}%`, background: cat.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pie Chart */}
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center">
              <PieChart className="w-5 h-5 mr-2 text-gold" />
              Contribution Share
            </h3>
            <button onClick={() => exportChartPNG(pieRef, 'Category_Pie')}
              className="p-1.5 hover:bg-white/5 border border-white/5 rounded-lg text-gray-400 hover:text-white transition-colors cursor-pointer"
              title="Download PNG">
              <ImageIcon className="w-4 h-4" />
            </button>
          </div>
          <div style={{ height: '340px' }}>
            {catData.grandTotal > 0 ? (
              <ReactECharts ref={pieRef} option={pieOption}
                style={{ width: '100%', height: '100%' }} theme="dark-theme" notMerge={true} />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-gray-500 italic">
                No collection data for this period
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Category Bar Chart */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center">
            <BarChart3 className="w-5 h-5 mr-2 text-gold" />
            {month === 'All' ? 'Total Collection by Category' : `${month} — Category Breakdown`}
          </h3>
          <button onClick={() => exportChartPNG(barRef, 'Category_Bar')}
            className="p-1.5 hover:bg-white/5 border border-white/5 rounded-lg text-gray-400 hover:text-white transition-colors cursor-pointer"
            title="Download PNG">
            <ImageIcon className="w-4 h-4" />
          </button>
        </div>
        <div style={{ height: '320px' }}>
          <ReactECharts ref={barRef} option={barOption}
            style={{ width: '100%', height: '100%' }} theme="dark-theme" notMerge={true} />
        </div>
      </div>

      {/* Stacked Monthly Trend */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center">
            <LineChart className="w-5 h-5 mr-2 text-gold" />
            Monthly Stacked Trend — All Categories
          </h3>
          <button onClick={() => exportChartPNG(stackRef, 'Category_Stack_Trend')}
            className="p-1.5 hover:bg-white/5 border border-white/5 rounded-lg text-gray-400 hover:text-white transition-colors cursor-pointer"
            title="Download PNG">
            <ImageIcon className="w-4 h-4" />
          </button>
        </div>
        <div style={{ height: '360px' }}>
          <ReactECharts ref={stackRef} option={stackOption}
            style={{ width: '100%', height: '100%' }} theme="dark-theme" notMerge={true} />
        </div>
      </div>
    </div>
  );
};

// ─── Monthly Comparison View (existing PRO-level logic) ────────────────────────
const MonthlyComparison = () => {
  const { financialYears, selectedFY, selectedModule } = useApp();

  // If "All Collections" mode → render Category Comparison view
  if (!selectedModule || selectedModule.code === 'all') {
    return <CategoryComparison selectedFY={selectedFY} selectedModule={selectedModule} />;
  }

  // States
  const [month, setMonth] = useState('April');
  const [selectedPros, setSelectedPros] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchRankings, setSearchRankings] = useState('');
  const [proDropdownOpen, setProDropdownOpen] = useState(false);
  const [topLimit, setTopLimit] = useState(10);
  const [chartView, setChartView] = useState('bar');
  const dropdownRef = useRef(null);

  // Chart refs
  const cylinderChartRef = useRef(null);
  const lineChartRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setProDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch metrics when FY, Module, or Month changes
  const fetchData = async () => {
    if (!selectedFY?._id) return;
    setLoading(true);
    try {
      const moduleParam = selectedModule && selectedModule.code !== 'all' ? `&module=${selectedModule._id}` : '';
      const res = await client.get(
        `/api/analytics/monthly-comparison?financialYear=${selectedFY._id}&month=${month}${moduleParam}`
      );
      if (res.data.success) {
        setData(res.data.data);
        const trends = res.data.data.allProsTrend || [];
        if (selectedPros.length === 0 && trends.length > 0) {
          const defaultSelect = trends
            .filter(p => p.status === 'active')
            .slice(0, 3)
            .map(p => p.proId);
          setSelectedPros(defaultSelect);
        }
      }
    } catch (err) {
      console.error('Failed to load monthly comparison analytics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedFY, selectedModule, month]);

  const nextMonth = () => {
    const idx = MONTHS.indexOf(month);
    setMonth(MONTHS[(idx + 1) % 12]);
  };

  const prevMonth = () => {
    const idx = MONTHS.indexOf(month);
    setMonth(MONTHS[(idx - 1 + 12) % 12]);
  };

  const toggleProSelection = (proId) => {
    if (selectedPros.includes(proId)) {
      setSelectedPros(selectedPros.filter(id => id !== proId));
    } else {
      setSelectedPros([...selectedPros, proId]);
    }
  };

  const exportChartPNG = (chartRef, chartName) => {
    if (chartRef.current) {
      const echartsInstance = chartRef.current.getEchartsInstance();
      const url = echartsInstance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#0a0f1d' });
      const link = document.createElement('a');
      link.href = url;
      link.download = `${chartName}_${month}_${selectedFY?._id === 'all' ? 'All-Years' : selectedFY?.year}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const exportExcel = () => {
    if (!data) return;
    const rankingSheetData = data.rankings.map(r => ({
      Rank: r.rank, Name: r.name, Designation: r.designation, Area: r.area,
      [`Collection in ${data.selectedMonth} (₹)`]: r.amount, Status: r.status
    }));
    const winnersSheetData = data.monthlyWinners.map(w => ({
      Month: w.month,
      WinnerName: w.winner ? w.winner.name : 'No Collection',
      WinnerDesignation: w.winner ? w.winner.designation : '-',
      WinnerArea: w.winner ? w.winner.area : '-',
      WinnerCollectionAmount: w.winner ? w.winner.amount : 0
    }));
    const trendSheetData = data.allProsTrend
      .filter(p => selectedPros.includes(p.proId))
      .map(p => {
        const row = { Name: p.name, Designation: p.designation, Area: p.area };
        MONTHS.forEach(m => { row[m] = p.monthlyAmounts[m] || 0; });
        return row;
      });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rankingSheetData), `${data.selectedMonth} Rankings`);
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(winnersSheetData), 'Monthly Best Performers');
    if (trendSheetData.length > 0) {
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(trendSheetData), 'PRO Trends');
    }
    XLSX.writeFile(workbook, `PRO_Monthly_Comparison_${data.selectedMonth}_${selectedFY?._id === 'all' ? 'All-Years' : selectedFY?.year}.xlsx`);
  };

  const exportPDF = () => {
    if (!data) return;
    const doc = new jsPDF();
    doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_FONT_BASE64);
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'bold');
    doc.setFont('Roboto');

    doc.setFontSize(16);
    doc.text(`PRO Monthly Analysis: ${data.selectedMonth} (${selectedFY?._id === 'all' ? 'All Years' : selectedFY?.label})`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Collection Scope: ${selectedModule?.name || 'All Collections'}`, 14, 21);
    doc.text(`Report Date: ${new Date().toLocaleDateString()}`, 14, 26);
    doc.setFontSize(12);
    doc.text('Growth Analysis Summary:', 14, 35);
    doc.setFontSize(9);
    doc.text(`- Current Month (${data.growthAnalysis.currentMonth}) Total: ₹${data.growthAnalysis.currentTotal.toLocaleString('en-IN')}`, 16, 42);
    doc.text(`- Previous Month (${data.growthAnalysis.prevMonth}) Total: ₹${data.growthAnalysis.prevTotal.toLocaleString('en-IN')}`, 16, 47);
    doc.text(`- Delta Index: ₹${data.growthAnalysis.diff.toLocaleString('en-IN')} (${data.growthAnalysis.pct >= 0 ? '+' : ''}${data.growthAnalysis.pct}%)`, 16, 52);
    doc.setFontSize(12);
    doc.text(`${data.selectedMonth} Performance Rankings (Top 10)`, 14, 62);
    const tableColumn = ['Rank', 'Name', 'Designation', 'Area', 'Collection (₹)', 'Status'];
    const tableRows = data.rankings.slice(0, 10).map(r => [r.rank, r.name, r.designation, r.area, r.amount.toLocaleString('en-IN'), r.status]);
    doc.autoTable({ head: [tableColumn], body: tableRows, startY: 67, theme: 'grid', styles: { fontSize: 8, font: 'Roboto' }, headStyles: { fillColor: [13, 27, 42], font: 'Roboto' } });
    doc.addPage();
    doc.setFontSize(14);
    doc.text('Monthly Winners (Best Performers per Month)', 14, 15);
    const winnersColumn = ['Month', 'Winner Name', 'Designation', 'Area', 'Collection (₹)'];
    const winnersRows = data.monthlyWinners.map(w => [w.month, w.winner ? w.winner.name : 'No Collection', w.winner ? w.winner.designation : '-', w.winner ? w.winner.area : '-', w.winner ? w.winner.amount.toLocaleString('en-IN') : '0']);
    doc.autoTable({ head: [winnersColumn], body: winnersRows, startY: 22, theme: 'grid', styles: { fontSize: 8, font: 'Roboto' }, headStyles: { fillColor: [13, 27, 42], font: 'Roboto' } });
    doc.save(`PRO_Monthly_Comparison_${data.selectedMonth}_${selectedFY?._id === 'all' ? 'All-Years' : selectedFY?.year}.pdf`);
  };

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold" />
      </div>
    );
  }

  const filteredRankings = data.rankings.filter(p =>
    p.name.toLowerCase().includes(searchRankings.toLowerCase()) ||
    p.area.toLowerCase().includes(searchRankings.toLowerCase())
  );

  // Helper to shorten names
  const shortenName = (name) => {
    if (!name) return '';
    if (name.startsWith('Others')) return name;
    const parts = name.split(/\s+/);
    if (parts.length > 1) {
      return parts[0] + '...';
    }
    if (name.length > 8) {
      return name.substring(0, 8) + '...';
    }
    return name;
  };

  // Helper to format amount in Lakhs
  const formatAmountLakhs = (val) => {
    if (val >= 100000) {
      return `₹${(val / 100000).toFixed(1)}L`;
    }
    return `₹${val.toLocaleString('en-IN')}`;
  };

  // Data processing for breakdown chart: filter out zeros, sort descending, group remaining into "Others (count)"
  const getProcessedBreakdownData = () => {
    if (!data || !data.rankings) return { names: [], values: [] };

    // 1. Filter out zero collections
    const nonZeroRankings = data.rankings.filter(r => r.amount > 0);

    // 2. Sort descending
    const sortedRankings = [...nonZeroRankings].sort((a, b) => b.amount - a.amount);

    if (topLimit === 'all' || sortedRankings.length <= topLimit) {
      return {
        names: sortedRankings.map(r => r.name),
        values: sortedRankings.map(r => r.amount)
      };
    }

    // 3. Keep top N, combine the rest into "Others (count)"
    const topN = sortedRankings.slice(0, topLimit);
    const rest = sortedRankings.slice(topLimit);
    const othersAmount = rest.reduce((sum, r) => sum + r.amount, 0);

    const finalNames = topN.map(r => r.name);
    const finalValues = topN.map(r => r.amount);

    if (othersAmount > 0) {
      finalNames.push(`Others (${rest.length})`);
      finalValues.push(othersAmount);
    }

    return { names: finalNames, values: finalValues };
  };

  const { names: barNames, values: barValues } = getProcessedBreakdownData();

  const topContributor = data.rankings && data.rankings.length > 0 
    ? [...data.rankings].sort((a, b) => b.amount - a.amount).find(r => r.amount > 0)
    : null;

  const getInsightText = () => {
    if (!data || !data.rankings || data.rankings.length === 0) return '';
    const sorted = [...data.rankings].filter(r => r.amount > 0).sort((a, b) => b.amount - a.amount);
    if (sorted.length === 0) return '';
    const top3Sum = sorted.slice(0, 3).reduce((sum, r) => sum + r.amount, 0);
    const total = data.growthAnalysis.currentTotal || 1;
    const pct = Math.round((top3Sum / total) * 100);
    return `Top 3 contributors generated ${pct}% of total collections this month.`;
  };
  const insightText = getInsightText();

  const cylinderOption = {
    backgroundColor: 'transparent',
    animation: true,
    animationDuration: 750,
    animationEasing: 'cubicOut',
    animationDurationUpdate: 750,
    animationEasingUpdate: 'cubicOut',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(10, 15, 29, 0.95)',
      borderColor: 'rgba(245, 197, 24, 0.3)',
      borderWidth: 1,
      textStyle: { color: '#fff', fontSize: 11 },
      formatter: (params) => {
        const val = params[0].value;
        const fullName = params[0].name;
        
        if (fullName.startsWith('Others')) {
          const match = fullName.match(/\((\d+)\)/);
          const count = match ? match[1] : 'N/A';
          return `
            <div class="p-2.5 font-sans min-w-[180px]">
              <p class="text-sm font-extrabold text-gray-300 border-b border-white/10 pb-1.5 mb-1.5">Others Group</p>
              <div class="space-y-1">
                <p class="flex justify-between text-xs"><span class="text-gray-400">Contributors:</span> <span class="font-bold text-white">${count}</span></p>
                <p class="flex justify-between text-xs"><span class="text-gray-400">Combined:</span> <span class="font-bold text-gold">₹${val.toLocaleString('en-IN')}</span></p>
              </div>
            </div>
          `;
        }

        const officer = data.rankings.find(r => r.name === fullName);
        const rank = officer ? officer.rank : '—';
        const totalCol = data.growthAnalysis.currentTotal || 1;
        const contributionPct = ((val / totalCol) * 100).toFixed(1);

        return `
          <div class="p-2.5 font-sans min-w-[200px]">
            <p class="text-sm font-extrabold text-white border-b border-white/10 pb-1.5 mb-1.5">${fullName}</p>
            <div class="space-y-1.5 font-medium">
              <div class="flex justify-between text-xs"><span class="text-gray-400">Collection:</span> <span class="font-bold text-gold">₹${val.toLocaleString('en-IN')}</span></div>
              <div class="flex justify-between text-xs"><span class="text-gray-400">Rank:</span> <span class="font-bold text-white">#${rank}</span></div>
              <div class="flex justify-between text-xs"><span class="text-gray-400">Contribution:</span> <span class="font-bold text-emerald-400">${contributionPct}%</span></div>
              <div class="flex justify-between text-xs"><span class="text-gray-400">Category:</span> <span class="font-bold text-blue-400">${selectedModule?.name || 'Collection'}</span></div>
            </div>
          </div>
        `;
      }
    },
    grid: { left: '3%', right: '4%', bottom: '15%', top: '15%', containLabel: true },
    xAxis: {
      type: 'category', data: barNames,
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      axisLabel: {
        color: '#9ca3af',
        rotate: 0,
        fontSize: 10,
        interval: 0,
        formatter: (val) => shortenName(val)
      }
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.03)' } },
      axisLabel: { color: '#9ca3af', formatter: (v) => `₹${v >= 100000 ? (v / 100000).toFixed(1) + 'L' : v.toLocaleString('en-IN')}` }
    },
    series: [
      {
        name: 'Collection', type: 'bar', barWidth: 25,
        data: barNames.map((name, idx) => {
          const val = barValues[idx];
          if (name.startsWith('Others')) {
            return {
              value: val,
              itemStyle: {
                color: {
                  type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
                  colorStops: [
                    { offset: 0, color: 'rgba(156, 163, 175, 0.75)' },
                    { offset: 0.5, color: 'rgba(156, 163, 175, 1)' },
                    { offset: 1, color: 'rgba(107, 114, 128, 0.75)' }
                  ]
                }
              }
            };
          }
          if (idx === 0) {
            return {
              value: val,
              itemStyle: {
                color: {
                  type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
                  colorStops: [
                    { offset: 0, color: 'rgba(245, 197, 24, 0.85)' },
                    { offset: 0.5, color: 'rgba(245, 197, 24, 1)' },
                    { offset: 1, color: 'rgba(212, 175, 55, 0.85)' }
                  ]
                },
                shadowBlur: 15,
                shadowColor: 'rgba(245, 197, 24, 0.4)'
              }
            };
          }
          if (idx === 1) {
            return {
              value: val,
              itemStyle: {
                color: {
                  type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
                  colorStops: [
                    { offset: 0, color: 'rgba(209, 213, 219, 0.85)' },
                    { offset: 0.5, color: 'rgba(209, 213, 219, 1)' },
                    { offset: 1, color: 'rgba(156, 163, 175, 0.85)' }
                  ]
                }
              }
            };
          }
          if (idx === 2) {
            return {
              value: val,
              itemStyle: {
                color: {
                  type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
                  colorStops: [
                    { offset: 0, color: 'rgba(180, 83, 9, 0.85)' },
                    { offset: 0.5, color: 'rgba(217, 119, 6, 1)' },
                    { offset: 1, color: 'rgba(146, 64, 14, 0.85)' }
                  ]
                }
              }
            };
          }
          return {
            value: val,
            itemStyle: {
              color: {
                type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
                colorStops: [
                  { offset: 0, color: 'rgba(59, 130, 246, 0.35)' },
                  { offset: 0.5, color: 'rgba(59, 130, 246, 0.5)' },
                  { offset: 1, color: 'rgba(29, 78, 216, 0.35)' }
                ]
              }
            }
          };
        }),
        z: 10
      },
      {
        name: 'Top Cap', type: 'pictorialBar', symbol: 'ellipse', symbolSize: [25, 8], symbolPosition: 'end', symbolOffset: [0, -4],
        label: {
          show: true,
          position: 'top',
          distance: 12,
          color: '#fff',
          fontSize: 10,
          fontWeight: 'bold',
          lineHeight: 14,
          formatter: (params) => {
            const idx = params.dataIndex;
            const val = typeof params.value === 'object' ? params.value.value : params.value;
            const name = params.name;
            if (name.startsWith('Others')) {
              return formatAmountLakhs(val);
            }
            if (idx === 0) return `🥇 #1\n${formatAmountLakhs(val)}`;
            if (idx === 1) return `🥈 #2\n${formatAmountLakhs(val)}`;
            if (idx === 2) return `🥉 #3\n${formatAmountLakhs(val)}`;
            if (idx < 5) return formatAmountLakhs(val);
            return '';
          }
        },
        data: barNames.map((name, idx) => {
          const val = barValues[idx];
          if (name.startsWith('Others')) {
            return {
              value: val > 0 ? val : 0,
              itemStyle: { color: '#e5e7eb', opacity: 0.9 }
            };
          }
          if (idx === 0) {
            return {
              value: val > 0 ? val : 0,
              itemStyle: { color: '#fff', opacity: 0.9 }
            };
          }
          if (idx === 1) {
            return {
              value: val > 0 ? val : 0,
              itemStyle: { color: '#f3f4f6', opacity: 0.9 }
            };
          }
          if (idx === 2) {
            return {
              value: val > 0 ? val : 0,
              itemStyle: { color: '#ffedd5', opacity: 0.9 }
            };
          }
          return {
            value: val > 0 ? val : 0,
            itemStyle: { color: 'rgba(147, 197, 253, 0.8)', opacity: 0.9 }
          };
        }),
        z: 12
      },
      {
        name: 'Bottom Cap', type: 'pictorialBar', symbol: 'ellipse', symbolSize: [25, 8], symbolPosition: 'start', symbolOffset: [0, 4],
        data: barNames.map((name, idx) => {
          const val = barValues[idx];
          if (name.startsWith('Others')) {
            return {
              value: val,
              itemStyle: { color: 'rgba(156, 163, 175, 1)' }
            };
          }
          if (idx === 0) {
            return {
              value: val,
              itemStyle: { color: 'rgba(212, 175, 55, 1)' }
            };
          }
          if (idx === 1) {
            return {
              value: val,
              itemStyle: { color: 'rgba(156, 163, 175, 1)' }
            };
          }
          if (idx === 2) {
            return {
              value: val,
              itemStyle: { color: 'rgba(146, 64, 14, 1)' }
            };
          }
          return {
            value: val,
            itemStyle: { color: 'rgba(29, 78, 216, 1)' }
          };
        }),
        z: 12
      }
    ]
  };

  const lineOption = {
    backgroundColor: 'transparent',
    animation: true,
    animationDuration: 750,
    animationEasing: 'cubicOut',
    animationDurationUpdate: 750,
    animationEasingUpdate: 'cubicOut',
    tooltip: cylinderOption.tooltip,
    grid: { left: '3%', right: '4%', bottom: '15%', top: '15%', containLabel: true },
    xAxis: {
      type: 'category', data: barNames,
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      axisLabel: cylinderOption.xAxis.axisLabel
    },
    yAxis: cylinderOption.yAxis,
    series: [
      {
        name: 'Collection',
        type: 'line',
        smooth: true,
        showSymbol: true,
        symbolSize: 10,
        itemStyle: {
          color: (params) => {
            const idx = params.dataIndex;
            const name = params.name;
            if (name.startsWith('Others')) return '#9ca3af';
            if (idx === 0) return '#f5c518';
            if (idx === 1) return '#d1d5db';
            if (idx === 2) return '#b45309';
            return '#3b82f6';
          }
        },
        lineStyle: { width: 3.5, color: '#f5c518' },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(245, 197, 24, 0.25)' },
              { offset: 1, color: 'transparent' }
            ]
          }
        },
        label: {
          show: true,
          position: 'top',
          distance: 10,
          color: '#fff',
          fontSize: 10,
          fontWeight: 'bold',
          lineHeight: 14,
          formatter: (params) => {
            const idx = params.dataIndex;
            const val = params.value;
            const name = params.name;
            if (name.startsWith('Others')) {
              return formatAmountLakhs(val);
            }
            if (idx === 0) return `🥇 #1\n${formatAmountLakhs(val)}`;
            if (idx === 1) return `🥈 #2\n${formatAmountLakhs(val)}`;
            if (idx === 2) return `🥉 #3\n${formatAmountLakhs(val)}`;
            if (idx < 5) return formatAmountLakhs(val);
            return '';
          }
        },
        data: barValues
      }
    ]
  };

  const trendsList = data.allProsTrend || [];
  const checkedPros = trendsList.filter(p => selectedPros.includes(p.proId));
  const lineColors = ['#f5c518', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#f97316'];
  const lineSeries = checkedPros.map((pro, idx) => ({
    name: pro.name, type: 'line', smooth: true, showSymbol: true, symbolSize: 8,
    lineStyle: { width: 3, color: lineColors[idx % lineColors.length] },
    itemStyle: { color: lineColors[idx % lineColors.length] },
    areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: lineColors[idx % lineColors.length] + '33' }, { offset: 1, color: lineColors[idx % lineColors.length] + '00' }] } },
    data: MONTHS.map(m => pro.monthlyAmounts[m] || 0)
  }));

  const trendOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(10, 15, 29, 0.95)', borderColor: 'rgba(245, 197, 24, 0.3)', borderWidth: 1, textStyle: { color: '#fff', fontSize: 11 } },
    legend: { textStyle: { color: '#9ca3af', fontSize: 10 }, data: checkedPros.map(p => p.name) },
    grid: { left: '3%', right: '4%', bottom: '12%', top: '15%', containLabel: true },
    xAxis: { type: 'category', data: MONTHS, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } }, axisLabel: { color: '#9ca3af', rotate: 25, fontSize: 10 } },
    yAxis: { type: 'value', axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.03)' } }, axisLabel: { color: '#9ca3af' } },
    series: lineSeries
  };

  const selectedMonthWinner = data.monthlyWinners.find(w => w.month === month)?.winner;

  return (
    <div className="p-6 space-y-6 animate-fadeIn pb-12">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold text-white">
              PRO Monthly <span className="gold-gradient-text">Comparison</span>
            </h1>
            {selectedFY?._id === 'all' && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border"
                style={{ color: '#d4af37', borderColor: '#d4af3744', background: '#d4af3718' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#d4af37' }} />
                Scope: All Years
              </span>
            )}
          </div>
          <p className="text-gray-400 text-sm mt-1">
            Conduct monthly collections relative rankings, multi-trend overlay, and dynamic growth analysis
          </p>
        </div>
        <div className="flex space-x-3 shrink-0">
          <button onClick={exportExcel}
            className="flex items-center space-x-2 bg-white/5 hover:bg-white/10 text-gold border border-gold/20 hover:border-gold/40 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer">
            <FileSpreadsheet className="w-4 h-4" /><span>Export Excel</span>
          </button>
          <button onClick={exportPDF}
            className="flex items-center space-x-2 bg-gradient-to-r from-gold to-gold-accent hover:from-gold-accent hover:to-gold text-dark-bg px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 glow-btn cursor-pointer">
            <FileText className="w-4 h-4" /><span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Control Filter Bar */}
      <div className="glass-card rounded-2xl p-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-6 relative z-20">
        <div className="flex items-center space-x-3 bg-[#0a0f1d]/60 border border-white/10 p-1.5 rounded-xl self-start md:self-auto">
          <button onClick={prevMonth} className="p-2 hover:bg-white/5 rounded-lg text-gold hover:text-white transition-colors cursor-pointer">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="w-32 text-center">
            <span className="text-sm font-bold text-white uppercase tracking-wider">{month}</span>
          </div>
          <button onClick={nextMonth} className="p-2 hover:bg-white/5 rounded-lg text-gold hover:text-white transition-colors cursor-pointer">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="relative flex-1 max-w-sm" ref={dropdownRef}>
          <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1.5">
            Trend Chart overlay ({selectedPros.length} selected)
          </label>
          <button onClick={() => setProDropdownOpen(!proDropdownOpen)}
            className="w-full flex items-center justify-between bg-[#0a0f1d]/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-semibold text-white focus:outline-none hover:border-gold/30 transition-all cursor-pointer">
            <span className="truncate">{selectedPros.length === 0 ? 'Select PRO Officers' : `${selectedPros.length} Officers Selected`}</span>
            <ChevronDown className="w-4 h-4 text-gold shrink-0" />
          </button>
          {proDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-[#0d1b2a] border border-white/10 rounded-xl overflow-hidden shadow-2xl max-h-60 overflow-y-auto no-scrollbar">
              {trendsList.map((p) => {
                const isSelected = selectedPros.includes(p.proId);
                return (
                  <button key={p.proId} onClick={() => toggleProSelection(p.proId)}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm text-left hover:bg-white/5 transition-all text-white border-b border-white/5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-gold border-gold text-dark-bg' : 'border-white/20'}`}>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </span>
                      <div className="truncate">
                        <div className="font-semibold">{p.name}</div>
                        <div className="text-[10px] text-gray-500 truncate">{p.area}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="text-gray-500 hidden lg:flex items-center space-x-3 shrink-0">
          <LineChart className="w-6 h-6 text-gold/60" />
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">PRO Monthly Index Panel</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="glass-card rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute right-4 top-4 p-2 bg-white/5 rounded-lg border border-white/5 text-gold"><Calendar className="w-5 h-5" /></div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{month} Collection</p>
          <h3 className="text-3xl font-extrabold text-white mt-2"><AnimatedCounter value={data.growthAnalysis.currentTotal} formatAsCurrency={true} /></h3>
          <p className="text-xs text-gray-500 mt-2">Total batch collections</p>
        </div>
        <div className="glass-card rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute right-4 top-4 p-2 bg-white/5 rounded-lg border border-white/5 text-gray-400"><Calendar className="w-5 h-5" /></div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{data.growthAnalysis.prevMonth} Total</p>
          <h3 className="text-3xl font-extrabold text-white/80 mt-2"><AnimatedCounter value={data.growthAnalysis.prevTotal} formatAsCurrency={true} /></h3>
          <p className="text-xs text-gray-500 mt-2">Previous comparison baseline</p>
        </div>
        <div className="glass-card rounded-2xl p-6 relative overflow-hidden">
          <div className={`absolute right-4 top-4 p-2 rounded-lg border text-sm font-bold flex items-center gap-0.5 ${data.growthAnalysis.pct >= 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
            <Percent className="w-3.5 h-3.5" />
            <span>{data.growthAnalysis.pct >= 0 ? '+' : ''}{data.growthAnalysis.pct}%</span>
          </div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Growth Index</p>
          <h3 className={`text-3xl font-extrabold mt-2 ${data.growthAnalysis.diff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            <AnimatedCounter value={data.growthAnalysis.diff} formatAsCurrency={true} prefix={data.growthAnalysis.diff >= 0 ? '+' : ''} />
          </h3>
          <p className="text-xs text-gray-500 mt-2">Growth difference</p>
        </div>
        <div className="glass-card rounded-2xl p-6 relative bg-gradient-to-br from-[#0c1b2a] to-gold/5 border-gold/15">
          <div className="absolute right-4 top-4 p-1.5 bg-gold/10 border border-gold/25 rounded-lg text-gold animate-pulse"><Crown className="w-5 h-5" /></div>
          <p className="text-xs font-extrabold text-gold uppercase tracking-widest flex items-center gap-1">{month} Best Performer</p>
          {selectedMonthWinner ? (
            <div className="mt-2">
              <h4 className="text-xl font-bold text-white truncate">{selectedMonthWinner.name}</h4>
              <p className="text-xs text-gray-400">{selectedMonthWinner.designation} • {selectedMonthWinner.area}</p>
              <span className="inline-block mt-2 text-sm font-extrabold text-gold">₹{selectedMonthWinner.amount.toLocaleString('en-IN')}</span>
            </div>
          ) : (
            <p className="text-sm text-gray-500 mt-4 font-semibold italic">No data recorded</p>
          )}
        </div>
      </div>

      {/* Charts */}
      <div className="flex flex-col gap-6">
        <div className="glass-card rounded-2xl p-6 flex flex-col">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5 shrink-0">
            <h3 className="text-lg font-bold text-white flex items-center">
              <Trophy className="w-5 h-5 mr-2 text-gold" />{month} Collection Breakdown
            </h3>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Top N Filter */}
              <div className="flex items-center bg-[#0a0f1d]/60 border border-white/10 p-1 rounded-xl">
                {[
                  { label: 'Top 10', value: 10 },
                  { label: 'Top 15', value: 15 },
                  { label: 'Show All', value: 'all' }
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setTopLimit(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      topLimit === opt.value
                        ? 'bg-gold text-dark-bg'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* View Switcher */}
              <div className="flex items-center bg-[#0a0f1d]/60 border border-white/10 p-1 rounded-xl">
                {[
                  { label: 'Bar', value: 'bar', icon: BarChart3 },
                  { label: 'Line', value: 'line', icon: LineChart }
                ].map(opt => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setChartView(opt.value)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        chartView === opt.value
                          ? 'bg-gold text-dark-bg'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              <button onClick={() => exportChartPNG(cylinderChartRef, 'Cylinder_Chart')}
                className="p-1.5 hover:bg-white/5 border border-white/5 rounded-lg text-gray-400 hover:text-white transition-colors cursor-pointer" title="Download PNG Chart">
                <ImageIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Executive Summary Card */}
          {barValues.length > 0 && topContributor && (
            <div className="mb-6 glass-card bg-[#0d1b2a]/30 border-white/5 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
              <div className="absolute right-4 top-4 p-2 bg-gold/10 border border-gold/20 rounded-xl text-gold">
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gold uppercase tracking-widest">Top Contributor</p>
                <h4 className="text-xl font-extrabold text-white mt-1">{topContributor.name}</h4>
                <p className="text-xs text-gray-400 mt-1">{topContributor.designation} • {topContributor.area}</p>
              </div>
              <div className="text-left md:text-right mt-2 md:mt-0">
                <p className="text-2xl font-black text-gold">₹{topContributor.amount.toLocaleString('en-IN')}</p>
                <p className="text-xs font-bold text-emerald-400 mt-1">
                  {((topContributor.amount / (data.growthAnalysis.currentTotal || 1)) * 100).toFixed(1)}% of total collection
                </p>
              </div>
            </div>
          )}

          <div style={{ height: '580px' }} className="relative w-full">
            {barValues.length > 0 ? (
              <ReactECharts ref={cylinderChartRef} option={chartView === 'bar' ? cylinderOption : lineOption} style={{ width: '100%', height: '100%' }} theme="dark-theme" notMerge={true} lazyUpdate={true} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500 italic">No collections reported this month</div>
            )}
          </div>

          {/* Insight Banner */}
          {barValues.length > 0 && insightText && (
            <div className="mt-6 p-4 rounded-xl border border-blue-500/10 bg-blue-500/5 text-blue-400 flex items-center gap-3">
              <TrendingUp className="w-5 h-5 shrink-0" />
              <p className="text-xs font-semibold leading-relaxed">
                <span className="font-bold uppercase tracking-wider text-[10px] bg-blue-500/10 px-2 py-0.5 rounded mr-2">Insight</span>
                {insightText}
              </p>
            </div>
          )}
        </div>

        <div className="glass-card rounded-2xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <h3 className="text-lg font-bold text-white flex items-center">
              <LineChart className="w-5 h-5 mr-2 text-gold" />PRO Performance Trends Overlay
            </h3>
            <button onClick={() => exportChartPNG(lineChartRef, 'Trends_Overlay_Chart')}
              className="p-1.5 hover:bg-white/5 border border-white/5 rounded-lg text-gray-400 hover:text-white transition-colors cursor-pointer" title="Download PNG Chart">
              <ImageIcon className="w-4 h-4" />
            </button>
          </div>
          <div style={{ height: '500px' }} className="relative w-full">
            {selectedPros.length > 0 ? (
              <ReactECharts ref={lineChartRef} option={trendOption} style={{ width: '100%', height: '100%' }} theme="dark-theme" notMerge={true} lazyUpdate={true} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500 italic">Select one or more PRO officers from overlay dropdown to display trends</div>
            )}
          </div>
        </div>
      </div>

      {/* Monthly Winners Carousel */}
      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center">
          <Crown className="w-5 h-5 mr-2 text-gold" />Financial Year Monthly Winners
        </h3>
        <div className="flex overflow-x-auto space-x-4 pb-2 scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-transparent">
          {data.monthlyWinners.map((w, index) => (
            <div key={index}
              className={`min-w-[200px] flex-1 glass-card rounded-xl p-4 flex flex-col justify-between border ${w.month === month ? 'border-gold/30 bg-gold/5 shadow-md shadow-gold/5 scale-[1.01]' : 'border-white/5 bg-[#0a0f1d]/20'} transition-all duration-300`}>
              <div>
                <span className="text-[10px] uppercase font-extrabold tracking-widest text-gray-500 block mb-1">{w.month}</span>
                {w.winner ? (
                  <><h4 className="font-bold text-sm text-white truncate">{w.winner.name}</h4><p className="text-[10px] text-gray-400 mt-0.5 truncate">{w.winner.area}</p></>
                ) : (
                  <p className="text-xs text-gray-500 italic mt-1 font-semibold">No entries</p>
                )}
              </div>
              {w.winner && <span className="text-xs font-extrabold text-gold mt-3 block">₹{w.winner.amount.toLocaleString('en-IN')}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Rankings Table */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 mb-6">
          <h3 className="text-lg font-bold text-white flex items-center">
            <Trophy className="w-5 h-5 mr-2 text-gold" />{month} Rankings Table
          </h3>
          <div className="relative w-full md:w-80">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500"><Search className="w-4 h-4" /></span>
            <input type="text" value={searchRankings} onChange={(e) => setSearchRankings(e.target.value)}
              placeholder="Search rankings by name or area..."
              className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-gold transition-colors" />
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-white/10 no-scrollbar">
          <table className="w-full text-left border-collapse min-w-[400px]">
            <thead>
              <tr className="bg-white/5 text-gray-400 text-xs font-bold uppercase border-b border-white/10">
                <th className="p-4 w-20 text-center">Rank</th>
                <th className="p-4">Name</th>
                <th className="p-4 text-right">Collection Amount</th>
                <th className="p-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm text-gray-300">
              {filteredRankings.length > 0 ? (
                filteredRankings.map((pro) => (
                  <tr key={pro.proId} className="hover:bg-white/5 transition-colors">
                    <td className="p-4 text-center font-bold">
                      {pro.amount > 0 ? (pro.rank <= 3 ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gold/10 text-gold text-xs font-extrabold border border-gold/30">{pro.rank}</span> : pro.rank) : '-'}
                    </td>
                    <td className="p-4 font-bold text-white">{pro.name}</td>
                    <td className="p-4 text-right font-extrabold text-white">₹{pro.amount.toLocaleString('en-IN')}</td>
                    <td className="p-4 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${pro.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-400'}`}>
                        {pro.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="4" className="p-8 text-center text-gray-500 italic">No matching rankings found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MonthlyComparison;
