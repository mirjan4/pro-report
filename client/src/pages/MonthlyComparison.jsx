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
      'Amount (INR)': c.value,
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
    doc.setFontSize(16);
    doc.text(`Collection Categories Comparison — ${selectedFY?.label || 'All Years'}`, 14, 15);
    doc.setFontSize(9);
    doc.text(`Scope: ${month === 'All' ? 'Full Year' : month} | Generated: ${new Date().toLocaleDateString()}`, 14, 22);

    doc.autoTable({
      head: [['Category', 'Amount (INR)', 'Contribution %']],
      body: catData.categoryBreakdown.map(c => [c.name, `₹${c.value.toLocaleString('en-IN')}`, `${c.pct}%`]),
      startY: 28,
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [13, 27, 42] }
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
      data: cats.map(c => c.name),
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
      data: cats.map(c => ({
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
      data: cats.map(c => ({ name: c.name, value: c.value, itemStyle: { color: c.color } }))
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
    legend: { top: '2%', textStyle: { color: '#9ca3af', fontSize: 10 }, data: mods.map(m => m.name) },
    grid: { left: '3%', right: '4%', bottom: '10%', top: '15%', containLabel: true },
    xAxis: {
      type: 'category',
      data: MONTHS.map(m => m.substring(0, 3)),
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      axisLabel: { color: '#9ca3af', fontSize: 10 }
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.03)' } },
      axisLabel: { color: '#9ca3af', formatter: v => v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v }
    },
    series: mods.map(mod => ({
      name: mod.name,
      type: 'bar',
      stack: 'total',
      barWidth: '55%',
      itemStyle: { color: mod.color, borderRadius: [0, 0, 0, 0] },
      emphasis: { focus: 'series' },
      data: catData.monthlyByCategory.map(row => row[mod.code] || 0)
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
      [`Collection in ${data.selectedMonth} (INR)`]: r.amount, Status: r.status
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
    doc.setFontSize(16);
    doc.text(`PRO Monthly Analysis: ${data.selectedMonth} (${selectedFY?._id === 'all' ? 'All Years' : selectedFY?.label})`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Collection Scope: ${selectedModule?.name || 'All Collections'}`, 14, 21);
    doc.text(`Report Date: ${new Date().toLocaleDateString()}`, 14, 26);
    doc.setFontSize(12);
    doc.text('Growth Analysis Summary:', 14, 35);
    doc.setFontSize(9);
    doc.text(`- Current Month (${data.growthAnalysis.currentMonth}) Total: INR ${data.growthAnalysis.currentTotal.toLocaleString('en-IN')}`, 16, 42);
    doc.text(`- Previous Month (${data.growthAnalysis.prevMonth}) Total: INR ${data.growthAnalysis.prevTotal.toLocaleString('en-IN')}`, 16, 47);
    doc.text(`- Delta Index: INR ${data.growthAnalysis.diff.toLocaleString('en-IN')} (${data.growthAnalysis.pct >= 0 ? '+' : ''}${data.growthAnalysis.pct}%)`, 16, 52);
    doc.setFontSize(12);
    doc.text(`${data.selectedMonth} Performance Rankings (Top 10)`, 14, 62);
    const tableColumn = ['Rank', 'Name', 'Designation', 'Area', 'Collection (INR)', 'Status'];
    const tableRows = data.rankings.slice(0, 10).map(r => [r.rank, r.name, r.designation, r.area, r.amount.toLocaleString('en-IN'), r.status]);
    doc.autoTable({ head: [tableColumn], body: tableRows, startY: 67, theme: 'grid', styles: { fontSize: 8 }, headStyles: { fillColor: [13, 27, 42] } });
    doc.addPage();
    doc.setFontSize(14);
    doc.text('Monthly Winners (Best Performers per Month)', 14, 15);
    const winnersColumn = ['Month', 'Winner Name', 'Designation', 'Area', 'Collection (INR)'];
    const winnersRows = data.monthlyWinners.map(w => [w.month, w.winner ? w.winner.name : 'No Collection', w.winner ? w.winner.designation : '-', w.winner ? w.winner.area : '-', w.winner ? w.winner.amount.toLocaleString('en-IN') : '0']);
    doc.autoTable({ head: [winnersColumn], body: winnersRows, startY: 22, theme: 'grid', styles: { fontSize: 8 }, headStyles: { fillColor: [13, 27, 42] } });
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

  const barNames = data.rankings.map(r => r.name);
  const barValues = data.rankings.map(r => r.amount);

  const cylinderOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(10, 15, 29, 0.95)',
      borderColor: 'rgba(245, 197, 24, 0.3)',
      borderWidth: 1,
      textStyle: { color: '#fff', fontSize: 11 },
      formatter: (params) => {
        const val = params[0].value;
        return `<div class="p-1 font-sans"><p class="text-[10px] text-gray-400 font-bold uppercase tracking-wider">${params[0].name}</p><p class="text-sm font-extrabold text-gold mt-1">₹${val.toLocaleString('en-IN')}</p></div>`;
      }
    },
    grid: { left: '3%', right: '4%', bottom: '15%', top: '12%', containLabel: true },
    xAxis: {
      type: 'category', data: barNames,
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      axisLabel: { color: '#9ca3af', rotate: 35, fontSize: 10, interval: 0 }
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
        itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: 'rgba(245, 197, 24, 0.75)' }, { offset: 0.5, color: 'rgba(245, 197, 24, 1)' }, { offset: 1, color: 'rgba(212, 175, 55, 0.75)' }] } },
        data: barValues, z: 10
      },
      { name: 'Top Cap', type: 'pictorialBar', symbol: 'ellipse', symbolSize: [25, 8], symbolPosition: 'end', symbolOffset: [0, -4], data: barValues.map(v => (v > 0 ? v : 0)), z: 12, itemStyle: { color: '#fff', opacity: 0.9 } },
      { name: 'Bottom Cap', type: 'pictorialBar', symbol: 'ellipse', symbolSize: [25, 8], symbolPosition: 'start', symbolOffset: [0, 4], data: barValues, z: 12, itemStyle: { color: 'rgba(212, 175, 55, 1)' } }
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
          <div className="flex items-center justify-between mb-4 shrink-0">
            <h3 className="text-lg font-bold text-white flex items-center">
              <Trophy className="w-5 h-5 mr-2 text-gold" />{month} Collection Breakdown
            </h3>
            <button onClick={() => exportChartPNG(cylinderChartRef, 'Cylinder_Chart')}
              className="p-1.5 hover:bg-white/5 border border-white/5 rounded-lg text-gray-400 hover:text-white transition-colors cursor-pointer" title="Download PNG Chart">
              <ImageIcon className="w-4 h-4" />
            </button>
          </div>
          <div style={{ height: '500px' }} className="relative w-full">
            {barValues.length > 0 ? (
              <ReactECharts ref={cylinderChartRef} option={cylinderOption} style={{ width: '100%', height: '100%' }} theme="dark-theme" notMerge={true} lazyUpdate={true} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500 italic">No collections reported this month</div>
            )}
          </div>
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
