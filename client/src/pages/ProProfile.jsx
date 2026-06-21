import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import client from '../api/client';
import EChartWrapper from '../components/EChartWrapper';
import {
  ArrowLeft, User, BarChart3, LineChart, Award, TrendingUp, Calendar,
  Zap, AlertCircle, GitCompare, ArrowRight, ChevronDown, Check,
  Sparkles, Clock, CalendarDays
} from 'lucide-react';
import AnimatedCounter from '../components/AnimatedCounter';

const MONTHS = [
  'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December', 'January', 'February', 'March'
];


// ---------- Compact Select Dropdown ----------
const FilterDropdown = ({ label, value, options, onChange, icon: Icon }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find(o => o.value === value);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 bg-[#0a0f1d]/80 border border-white/10 hover:border-gold/40 rounded-xl px-3.5 py-2 text-xs font-semibold text-white transition-all duration-200 cursor-pointer group min-w-[130px]"
      >
        {Icon && <Icon className="w-3.5 h-3.5 text-gold shrink-0" />}
        <div className="flex flex-col items-start leading-none">
          <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-0.5">{label}</span>
          <span className="text-white font-bold truncate max-w-[110px]">{selected?.label || '—'}</span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 ml-auto transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 bg-[#0d1b2a] border border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-[160px] max-h-60 overflow-y-auto no-scrollbar animate-fadeIn">
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-left hover:bg-white/5 transition-colors text-white border-b border-white/5 last:border-0 cursor-pointer"
            >
              <span className={value === opt.value ? 'font-bold text-gold' : 'text-gray-300'}>{opt.label}</span>
              {value === opt.value && <Check className="w-3 h-3 text-gold shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ---------- Main Component ----------
const ProProfile = () => {
  const { id } = useParams();
  const { selectedFY, financialYears } = useApp();

  // ---- Filter State ----
  const [filterFY, setFilterFY] = useState(null);       // selected FY _id (string)
  const [filterMonth, setFilterMonth] = useState('all'); // 'all' or month name

  // ---- Data State ----
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // ---- Year-on-Year Comparison State ----
  const [compYear1, setCompYear1] = useState('');
  const [compYear2, setCompYear2] = useState('');
  const [compData1, setCompData1] = useState(null);
  const [compData2, setCompData2] = useState(null);
  const [compLoading, setCompLoading] = useState(false);

  // ---- Month-on-Month Comparison State ----
  const [compMonth1, setCompMonth1] = useState('April');
  const [compMonth2, setCompMonth2] = useState('May');

  // ---- Auto-align comparison months when filterMonth changes ----
  useEffect(() => {
    if (filterMonth !== 'all') {
      setCompMonth2(filterMonth);
      const idx = MONTHS.indexOf(filterMonth);
      const prev = idx > 0 ? MONTHS[idx - 1] : 'March';
      setCompMonth1(prev);
    }
  }, [filterMonth]);

  // ---- Initialise filterFY from context ----
  useEffect(() => {
    if (!filterFY && selectedFY?._id) setFilterFY(selectedFY._id);
  }, [selectedFY]);

  // ---- Initialise comparison years ----
  useEffect(() => {
    if (financialYears.length >= 2) {
      setCompYear1(financialYears[1]._id);
      setCompYear2(financialYears[0]._id);
    } else if (financialYears.length === 1) {
      setCompYear1(financialYears[0]._id);
      setCompYear2(financialYears[0]._id);
    }
  }, [financialYears]);

  // ---- Main data fetch (reacts to filterFY + filterMonth) ----
  useEffect(() => {
    const fetch = async () => {
      if (!filterFY) return;
      setLoading(true);
      try {
        let url = `/api/analytics/pro/${id}?financialYear=${filterFY}`;
        if (filterMonth !== 'all') url += `&month=${filterMonth}`;
        const res = await client.get(url);
        if (res.data.success) setData(res.data.data);
      } catch (err) {
        console.error('Failed to load PRO analytics', err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id, filterFY, filterMonth]);

  // ---- Year-on-Year comparison fetch ----
  useEffect(() => {
    const fetchComp = async () => {
      if (!compYear1 || !compYear2) return;
      setCompLoading(true);
      try {
        const [r1, r2] = await Promise.all([
          client.get(`/api/analytics/pro/${id}?financialYear=${compYear1}`),
          client.get(`/api/analytics/pro/${id}?financialYear=${compYear2}`)
        ]);
        if (r1.data.success) setCompData1(r1.data.data);
        if (r2.data.success) setCompData2(r2.data.data);
      } catch (err) {
        console.error('Failed to load comparison data', err);
      } finally {
        setCompLoading(false);
      }
    };
    fetchComp();
  }, [id, compYear1, compYear2]);

  // ---- Quick Action Handlers ----

  const handleFullYear = () => {
    setFilterMonth('all');
  };

  // ---- Dropdown Options ----
  const fyOptions = financialYears.map(fy => ({ value: fy._id, label: fy.label }));
  const monthOptions = [
    { value: 'all', label: 'All Months' },
    ...MONTHS.map(m => ({ value: m, label: m }))
  ];

  // ---- Comparison chart data ----
  const comparisonBreakdown = MONTHS.map((month) => {
    const item1 = compData1?.monthlyBreakdown?.find(m => m.month === month);
    const item2 = compData2?.monthlyBreakdown?.find(m => m.month === month);
    return { month, year1Amount: item1?.current || 0, year2Amount: item2?.current || 0 };
  });

  const year1Total = compData1?.total || 0;
  const year2Total = compData2?.total || 0;
  const compDiff = year2Total - year1Total;
  const compGrowth = year1Total > 0 ? (compDiff / year1Total * 100) : 0;
  const year1Label = financialYears.find(y => y._id === compYear1)?.label || 'Base Year';
  const year2Label = financialYears.find(y => y._id === compYear2)?.label || 'Comparison Year';

  // Calculate month-to-month growth and details
  let monthGrowth = 0;
  let prevMonthName = '';
  let prevMonthVal = 0;
  let currentMonthVal = 0;
  let trendDirection = 'stable';

  if (filterMonth !== 'all') {
    const curMonthData = data?.monthlyBreakdown?.find(m => m.month === filterMonth);
    currentMonthVal = curMonthData ? curMonthData.current : 0;

    const monthIdx = MONTHS.indexOf(filterMonth);
    if (monthIdx > 0) {
      prevMonthName = MONTHS[monthIdx - 1];
      const prevMonthData = data?.monthlyBreakdown?.find(m => m.month === prevMonthName);
      prevMonthVal = prevMonthData ? prevMonthData.current : 0;
    } else {
      prevMonthName = 'March (Prev FY)';
      const marchData = data?.monthlyBreakdown?.find(m => m.month === 'March');
      prevMonthVal = marchData ? marchData.previous : 0;
    }

    monthGrowth = prevMonthVal > 0 
      ? Math.round(((currentMonthVal - prevMonthVal) / prevMonthVal * 100) * 100) / 100 
      : (currentMonthVal > 0 ? 100 : 0);
    trendDirection = monthGrowth > 0 ? 'improving' : monthGrowth < 0 ? 'declining' : 'stable';
  }

  // Dynamic Peak & Lowest Month Calculation
  const nonZeroCurrent = data?.monthlyBreakdown?.filter(m => m.current > 0) || [];
  const maxVal = nonZeroCurrent.length > 0 ? Math.max(...data.monthlyBreakdown.map(m => m.current)) : 0;
  const minVal = nonZeroCurrent.length > 0 ? Math.min(...nonZeroCurrent.map(m => m.current)) : 0;
  const peakMonth = data?.monthlyBreakdown?.find(m => m.current === maxVal)?.month || 'None';
  const lowestMonth = data?.monthlyBreakdown?.find(m => m.current === minVal)?.month || 'None';

  const nonZeroMonthsCount = nonZeroCurrent.length;

  // Monthly Mode Comparison Data
  const m1Data = data?.monthlyBreakdown?.find(m => m.month === compMonth1);
  const m2Data = data?.monthlyBreakdown?.find(m => m.month === compMonth2);
  const m1Total = m1Data ? m1Data.current : 0;
  const m2Total = m2Data ? m2Data.current : 0;
  const mDiff = m2Total - m1Total;
  const mGrowth = m1Total > 0 ? (mDiff / m1Total * 100) : 0;

  // ---- ECharts options ----
  const dynamicComparisonChartOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: 'rgba(13,27,42,0.9)', borderColor: 'rgba(245,197,24,0.3)', textStyle: { color: '#fff' } },
    legend: { textStyle: { color: '#9ca3af' } },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
    xAxis: { type: 'category', data: MONTHS.map(m => m.substring(0, 3)), axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, axisLabel: { color: '#9ca3af' } },
    yAxis: { type: 'value', axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }, axisLabel: { color: '#9ca3af' } },
    series: [
      { name: year1Label, type: 'bar', barGap: '10%', itemStyle: { color: '#1e3a8a', borderRadius: [4, 4, 0, 0] }, data: comparisonBreakdown.map(m => m.year1Amount) },
      { name: year2Label, type: 'bar', itemStyle: { color: '#f5c518', borderRadius: [4, 4, 0, 0] }, data: comparisonBreakdown.map(m => m.year2Amount) }
    ]
  };

  const monthlyBarChartOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: 'rgba(13,27,42,0.9)', borderColor: 'rgba(245,197,24,0.3)', textStyle: { color: '#fff' } },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
    xAxis: { type: 'category', data: [compMonth1, compMonth2], axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, axisLabel: { color: '#9ca3af' } },
    yAxis: { type: 'value', axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }, axisLabel: { color: '#9ca3af' } },
    series: [
      {
        name: 'Collection',
        type: 'bar',
        barWidth: '30%',
        itemStyle: {
          color: (params) => params.dataIndex === 0 ? '#1e3a8a' : '#f5c518',
          borderRadius: [4, 4, 0, 0]
        },
        data: [m1Total, m2Total]
      }
    ]
  };

  const monthlyTrendLineOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(13,27,42,0.9)', borderColor: 'rgba(245,197,24,0.3)', textStyle: { color: '#fff' } },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
    xAxis: { type: 'category', data: MONTHS.map(m => m.substring(0, 3)), axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, axisLabel: { color: '#9ca3af' } },
    yAxis: { type: 'value', axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }, axisLabel: { color: '#9ca3af' } },
    series: [
      {
        name: 'Monthly Trend',
        type: 'line',
        smooth: true,
        showSymbol: true,
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
        data: data?.monthlyBreakdown?.map(m => m.current) || []
      }
    ]
  };

  const barChartOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: 'rgba(13,27,42,0.9)', borderColor: 'rgba(245,197,24,0.3)', textStyle: { color: '#fff' } },
    legend: { textStyle: { color: '#9ca3af' } },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
    xAxis: { type: 'category', data: data?.monthlyBreakdown?.map(m => m.month.substring(0, 3)) || [], axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, axisLabel: { color: '#9ca3af', rotate: 30 } },
    yAxis: { type: 'value', axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }, axisLabel: { color: '#9ca3af' } },
    series: [
      { name: 'Current Year', type: 'bar', itemStyle: { color: '#f5c518', borderRadius: [4, 4, 0, 0] }, data: data?.monthlyBreakdown?.map(m => m.current) || [] },
      { name: 'Previous Year', type: 'bar', itemStyle: { color: '#1e3a8a', borderRadius: [4, 4, 0, 0] }, data: data?.monthlyBreakdown?.map(m => m.previous) || [] }
    ]
  };


  // ---- Insights ----
  const generateInsights = () => {
    if (!data) return [];
    const insights = [];

    if (filterMonth === 'all') {
      // --- Annual Mode Insights ---
      if (Number(data.consistencyScore) >= 80)
        insights.push({ type: 'success', text: `Highly consistent contributor! Officer engaged in collections in ${data.consistencyScore}% of reporting periods.` });
      else if (Number(data.consistencyScore) <= 30)
        insights.push({ type: 'danger', text: `Low reporting consistency detected. Active contributions made in only ${data.consistencyScore}% of reporting periods.` });

      if (data.trend === 'improving')
        insights.push({ type: 'success', text: `Strong upward performance trajectory! Collections average in the last 3 months is higher than earlier periods.` });
      else if (data.trend === 'declining')
        insights.push({ type: 'danger', text: `Warning: Downward collection trend registered. Recent months averages indicate falling performance metrics.` });

      if (data.growth > 0)
        insights.push({ type: 'success', text: `Registered a net positive growth of +${data.growth}% compared to the previous financial year.` });
      else if (data.growth < 0)
        insights.push({ type: 'danger', text: `Registered a negative growth index of ${data.growth}% compared to the previous financial year.` });
    } else {
      // --- Monthly Mode Insights ---
      if (Number(data.consistencyScore) >= 80)
        insights.push({ type: 'success', text: `Highly consistent contributor! Officer engaged in collections in ${data.consistencyScore}% of reporting periods this financial year.` });
      else if (Number(data.consistencyScore) <= 30)
        insights.push({ type: 'danger', text: `Low reporting consistency detected. Active contributions made in only ${data.consistencyScore}% of reporting periods this financial year.` });

      if (trendDirection === 'improving')
        insights.push({ type: 'success', text: `Officer performance is improving, showing an upward trajectory from ${prevMonthName}.` });
      else if (trendDirection === 'declining')
        insights.push({ type: 'danger', text: `Warning: Downward performance trend registered, with collections declining from ${prevMonthName}.` });

      if (monthGrowth > 0)
        insights.push({ type: 'success', text: `Registered a positive month-over-month growth of +${monthGrowth}% compared to ${prevMonthName}.` });
      else if (monthGrowth < 0)
        insights.push({ type: 'danger', text: `Registered a decline in month-over-month collections of ${monthGrowth}% compared to ${prevMonthName}.` });

      if (data.growth > 0)
        insights.push({ type: 'success', text: `Registered a net positive growth of +${data.growth}% compared to ${filterMonth} of the previous financial year.` });
      else if (data.growth < 0)
        insights.push({ type: 'danger', text: `Registered a negative growth index of ${data.growth}% compared to ${filterMonth} of the previous financial year.` });
    }

    return insights;
  };

  // ---- Active filter label ----
  const activeFYLabel = financialYears.find(y => y._id === filterFY)?.label || selectedFY?.label || '';
  const activeFilterLabel = filterMonth === 'all'
    ? `All Months · ${activeFYLabel}`
    : `${filterMonth} · ${activeFYLabel}`;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center text-gray-400">
        PRO Profile Analytics could not be loaded.
      </div>
    );
  }

  const insights = generateInsights();

  return (
    <div className="p-6 space-y-6">

      {/* ── Title Row + Filter Bar ── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">

        {/* Left: Back + Title */}
        <div className="flex items-center space-x-4 min-w-0">
          <Link to="/rankings" className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center truncate">
              <User className="w-7 h-7 mr-2.5 text-gold shrink-0" />
              <span className="truncate">{data.pro.name}</span>
              <span className="gold-gradient-text ml-2 shrink-0">Analytics</span>
            </h1>
            <p className="text-gray-400 text-xs mt-0.5 flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5 text-gold/60" />
              {activeFilterLabel}
            </p>
          </div>
        </div>

        {/* Right: Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">

          {/* Quick Actions */}

          <button
            onClick={handleFullYear}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all cursor-pointer ${
              filterMonth === 'all'
                ? 'bg-gold/10 border-gold/40 text-gold'
                : 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-gold/30 text-gray-300 hover:text-white'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            All Months
          </button>

          {/* Divider */}
          <div className="w-px h-6 bg-white/10 hidden sm:block" />

          {/* Year Dropdown */}
          <FilterDropdown
            label="Year"
            icon={Award}
            value={filterFY || ''}
            options={fyOptions}
            onChange={setFilterFY}
          />

          {/* Month Dropdown */}
          <FilterDropdown
            label="Month"
            icon={Calendar}
            value={filterMonth}
            options={monthOptions}
            onChange={setFilterMonth}
          />
        </div>
      </div>

      {/* ── Active Filter Chip ── */}
      {filterMonth !== 'all' && (
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gold/10 border border-gold/25 text-xs font-bold text-gold animate-fadeIn">
            <Calendar className="w-3 h-3" />
            Filtered: {filterMonth} · {activeFYLabel}
            <button
              onClick={handleFullYear}
              className="ml-1 text-gold/60 hover:text-gold transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>
          <span className="text-xs text-gray-500">KPIs, charts and insights reflect this period only</span>
        </div>
      )}

      {/* ── Profile + KPI Cards ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* KPI: Previous Period Collection */}
        <div className="glass-card rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest block">
              {filterMonth !== 'all' ? `Previous Month (${prevMonthName})` : 'Previous Year Collection'}
            </span>
            <h2 className="text-3xl font-extrabold text-white mt-2">
              <AnimatedCounter value={filterMonth !== 'all' ? prevMonthVal : data.prevTotal} formatAsCurrency={true} />
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              {filterMonth !== 'all' ? 'Month baseline' : 'Last FY total'}
            </p>
          </div>
          <div className="pt-4 border-t border-white/5 flex justify-between text-xs text-gray-400">
            <span>Status:</span>
            <span className={`font-bold uppercase ${data.pro.status === 'active' ? 'text-emerald-400' : 'text-gray-400'}`}>
              {data.pro.status}
            </span>
          </div>
        </div>

        {/* KPI: Total Collection */}
        <div className="glass-card rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest block">
              {filterMonth !== 'all' ? `${filterMonth} Collection` : 'Total Collection'}
            </span>
            <h2 className="text-3xl font-extrabold text-gold mt-2">
              <AnimatedCounter value={data.total} formatAsCurrency={true} />
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              {filterMonth !== 'all' ? 'Month scope collection' : 'Direct FY contribution'}
            </p>
          </div>
          <div className="pt-4 border-t border-white/5 flex justify-between text-xs text-gray-400">
            <span>Selected Period:</span>
            <span className="font-bold text-white">{filterMonth !== 'all' ? filterMonth : 'All Months'}</span>
          </div>
        </div>

        {/* KPI: Growth & Consistency */}
        <div className="glass-card rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest block">
              {filterMonth !== 'all' ? 'Monthly Growth & Consistency' : 'Growth & Consistency'}
            </span>
            <h2 className={`text-3xl font-extrabold mt-2 ${
              (filterMonth !== 'all' ? monthGrowth : data.growth) >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {(filterMonth !== 'all' ? monthGrowth : data.growth) >= 0 ? '+' : ''}
              {filterMonth !== 'all' ? monthGrowth : data.growth}%
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              {filterMonth !== 'all' ? `Month-to-month growth (${filterMonth} vs ${prevMonthName})` : 'Relative growth index'}
            </p>
          </div>
          <div className="pt-4 border-t border-white/5 space-y-1 text-xs text-gray-400">
            {filterMonth !== 'all' && (
              <div className="flex justify-between">
                <span>Prev Month ({prevMonthName}):</span>
                <span className="font-bold text-white">₹{prevMonthVal.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Consistency Index:</span>
              <span className="font-bold text-white">{data.consistencyScore}%</span>
            </div>
            {filterMonth !== 'all' && (
              <div className="flex justify-between">
                <span>Trend Direction:</span>
                <span className={`font-bold uppercase ${trendDirection === 'improving' ? 'text-emerald-400' : trendDirection === 'declining' ? 'text-rose-400' : 'text-gray-400'}`}>
                  {trendDirection}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* KPI: Peak / Lowest */}
        <div className="glass-card rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest block">Peak / Lowest Months</span>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-gray-400">Highest Month:</span>
                <span className="text-xs font-bold text-emerald-400">{peakMonth || 'None'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-400">Lowest Month:</span>
                <span className="text-xs font-bold text-rose-400">{lowestMonth || 'None'}</span>
              </div>
            </div>
          </div>
          <div className="pt-4 border-t border-white/5 flex justify-between text-xs text-gray-400">
            <span>Trend Vector:</span>
            <span className={`font-bold uppercase ${data.trend === 'improving' ? 'text-emerald-400' : data.trend === 'declining' ? 'text-rose-400' : 'text-gray-400'}`}>
              {data.trend}
            </span>
          </div>
        </div>
      </div>


      {/* ── Interactive Year-over-Year / Month-on-Month Comparison ── */}
      <div className="glass-card rounded-2xl p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/5 pb-4 gap-4">
          <h3 className="text-lg font-bold text-white flex items-center">
            <GitCompare className="w-5 h-5 mr-2 text-gold" />
            {filterMonth === 'all' ? 'Interactive Year-over-Year Comparison' : 'Interactive Monthly Comparison'}
          </h3>
          {filterMonth === 'all' ? (
            <div className="flex items-center space-x-2 animate-fadeIn">
              <select
                value={compYear1}
                onChange={(e) => setCompYear1(e.target.value)}
                className="bg-[#0a0f1d] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-gold cursor-pointer"
              >
                {financialYears.map(fy => (
                  <option key={fy._id} value={fy._id}>{fy.year}</option>
                ))}
              </select>
              <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
              <select
                value={compYear2}
                onChange={(e) => setCompYear2(e.target.value)}
                className="bg-[#0a0f1d] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-gold cursor-pointer"
              >
                {financialYears.map(fy => (
                  <option key={fy._id} value={fy._id}>{fy.year}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center space-x-2 animate-fadeIn">
              <select
                value={compMonth1}
                onChange={(e) => setCompMonth1(e.target.value)}
                className="bg-[#0a0f1d] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-gold cursor-pointer"
              >
                {MONTHS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
              <select
                value={compMonth2}
                onChange={(e) => setCompMonth2(e.target.value)}
                className="bg-[#0a0f1d] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-gold cursor-pointer"
              >
                {MONTHS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {filterMonth === 'all' ? (
          compLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gold" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center animate-fadeIn">
              <div className="lg:col-span-2 h-72">
                <EChartWrapper option={dynamicComparisonChartOption} />
              </div>
              <div className="space-y-4 bg-white/[0.01] border border-white/5 p-4 rounded-xl text-xs text-gray-300">
                <h4 className="font-bold text-sm text-white border-b border-white/5 pb-2 uppercase tracking-wider">Comparison Metrics</h4>
                <div className="flex justify-between">
                  <span>{year1Label} Total:</span>
                  <span className="font-semibold text-white">₹{year1Total.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span>{year2Label} Total:</span>
                  <span className="font-semibold text-white">₹{year2Total.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between border-t border-white/5 pt-2 font-bold">
                  <span>Difference:</span>
                  <span className={compDiff >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                    {compDiff >= 0 ? '+' : ''}₹{compDiff.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Growth Index:</span>
                  <span className={compGrowth >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                    {compGrowth >= 0 ? '+' : ''}{compGrowth.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          )
        ) : (
          nonZeroMonthsCount < 2 ? (
            <div className="py-12 text-center text-sm text-gray-400 italic">
              Not enough monthly data available for comparison.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center animate-fadeIn">
              <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 h-72">
                <div className="h-full">
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2 text-center">Bar Comparison</p>
                  <div className="h-[250px]">
                    <EChartWrapper option={monthlyBarChartOption} style={{ minHeight: '220px' }} />
                  </div>
                </div>
                <div className="h-full">
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2 text-center">Line Trend Overlay</p>
                  <div className="h-[250px]">
                    <EChartWrapper option={monthlyTrendLineOption} style={{ minHeight: '220px' }} />
                  </div>
                </div>
              </div>
              <div className="space-y-4 bg-white/[0.01] border border-white/5 p-4 rounded-xl text-xs text-gray-300">
                <h4 className="font-bold text-sm text-white border-b border-white/5 pb-2 uppercase tracking-wider">Monthly Comparison</h4>
                <div className="flex justify-between">
                  <span>{compMonth1} Total:</span>
                  <span className="font-semibold text-white">₹{m1Total.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span>{compMonth2} Total:</span>
                  <span className="font-semibold text-white">₹{m2Total.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between border-t border-white/5 pt-2 font-bold">
                  <span>Collection Difference:</span>
                  <span className={mDiff >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                    {mDiff >= 0 ? '+' : ''}₹{mDiff.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Growth Percentage:</span>
                  <span className={mGrowth >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                    {mGrowth >= 0 ? '+' : ''}{mGrowth.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Trend Direction:</span>
                  <span className={mDiff >= 0 ? 'text-emerald-400 uppercase' : 'text-rose-400 uppercase'}>
                    {mDiff >= 0 ? 'Increase' : 'Decrease'}
                  </span>
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {/* ── Static Charts for filtered FY ── */}
      {filterMonth === 'all' && (
        <div className="grid grid-cols-1 gap-6 animate-fadeIn">
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center">
                <BarChart3 className="w-5 h-5 mr-2 text-gold" />
                Annual Comparison Breakdown
                <span className="ml-2 text-xs text-gray-400 font-normal">
                  ({activeFYLabel})
                </span>
              </h3>
            </div>
            <div className="h-80">
              <EChartWrapper option={barChartOption} />
            </div>
          </div>
        </div>
      )}

      {/* ── Automated Insights ── */}
      <div className="glass-card rounded-2xl p-6 animate-fadeIn">
        <h3 className="text-lg font-bold text-white flex items-center mb-4">
          <Zap className="w-5 h-5 mr-2 text-gold animate-bounce" />
          Automated Officer Insights
          {filterMonth !== 'all' && (
            <span className="ml-3 text-[10px] px-2 py-0.5 rounded-full bg-gold/10 text-gold border border-gold/20 font-bold uppercase tracking-wider">
              {filterMonth}
            </span>
          )}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {insights.length > 0 ? (
            insights.map((ins, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-xl text-xs font-medium border ${
                  ins.type === 'success'
                    ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-300'
                    : 'bg-rose-500/5 border-rose-500/10 text-rose-300'
                }`}
              >
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>{ins.text}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-400">Insufficient collection history to generate automated profiling insights.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProProfile;
