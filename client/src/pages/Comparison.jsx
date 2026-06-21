import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import client from '../api/client';
import EChartWrapper from '../components/EChartWrapper';
import { GitCompare, ArrowRight, TrendingUp, TrendingDown, RefreshCw, BarChart2, Layers, PieChart } from 'lucide-react';
import AnimatedCounter from '../components/AnimatedCounter';

const Comparison = () => {
  const { financialYears, selectedModule } = useApp();
  const [year1, setYear1] = useState('');
  const [year2, setYear2] = useState('');
  const [comparisonData, setComparisonData] = useState(null);
  const [performers, setPerformers] = useState({ growth: [], decline: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const validYears = financialYears.filter(fy => fy._id !== 'all');
    if (validYears.length >= 2) {
      setYear1(validYears[1]._id);
      setYear2(validYears[0]._id);
    } else if (validYears.length === 1) {
      setYear1(validYears[0]._id);
      setYear2(validYears[0]._id);
    }
  }, [financialYears]);

  useEffect(() => {
    const fetchComparison = async () => {
      if (!year1 || !year2) return;
      setLoading(true);
      try {
        const modParam = selectedModule && selectedModule.code !== 'all' ? `&module=${selectedModule._id}` : '';
        const [compRes, rankings1Res, rankings2Res] = await Promise.all([
          client.get(`/api/analytics/comparison?year1=${year1}&year2=${year2}${modParam}`),
          client.get(`/api/analytics/rankings?financialYear=${year1}${modParam}`),
          client.get(`/api/analytics/rankings?financialYear=${year2}${modParam}`)
        ]);

        if (compRes.data.success) setComparisonData(compRes.data.data);

        if (rankings1Res.data.success && rankings2Res.data.success) {
          const list1 = rankings1Res.data.data.rankings || [];
          const list2 = rankings2Res.data.data.rankings || [];
          const diffList = [];
          const allProIds = new Set([...list1.map(p => p.proId), ...list2.map(p => p.proId)]);
          allProIds.forEach(pid => {
            const p1 = list1.find(p => p.proId === pid) || { total: 0, name: '' };
            const p2 = list2.find(p => p.proId === pid) || { total: 0, name: '' };
            const name = p2.name || p1.name;
            const prev = p1.total, curr = p2.total, diff = curr - prev;
            const pct = prev > 0 ? (diff / prev * 100) : (curr > 0 ? 100 : 0);
            diffList.push({ proId: pid, name, prev, curr, diff, pct: Math.round(pct * 100) / 100 });
          });
          const growth = [...diffList].filter(d => d.diff > 0).sort((a, b) => b.diff - a.diff).slice(0, 3);
          const decline = [...diffList].filter(d => d.diff < 0).sort((a, b) => a.diff - b.diff).slice(0, 3);
          setPerformers({ growth, decline });
        }
      } catch (err) {
        console.error('Failed to load comparison data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchComparison();
  }, [year1, year2, selectedModule]);

  const chartOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(13, 27, 42, 0.9)',
      borderColor: 'rgba(245, 197, 24, 0.3)',
      textStyle: { color: '#fff' }
    },
    legend: {
      textStyle: { color: '#9ca3af' }
    },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
    xAxis: {
      type: 'category',
      data: comparisonData?.year1?.monthly?.map(m => m.month) || [],
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      axisLabel: { color: '#9ca3af', rotate: 30 }
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      axisLabel: { color: '#9ca3af' }
    },
    series: [
      {
        name: comparisonData?.year1?.label || 'Year 1',
        type: 'bar',
        barGap: '10%',
        itemStyle: {
          color: '#1e3a8a',
          borderRadius: [4, 4, 0, 0]
        },
        data: comparisonData?.year1?.monthly?.map(m => m.total) || []
      },
      {
        name: comparisonData?.year2?.label || 'Year 2',
        type: 'bar',
        itemStyle: {
          color: '#f5c518',
          borderRadius: [4, 4, 0, 0]
        },
        data: comparisonData?.year2?.monthly?.map(m => m.total) || []
      }
    ]
  };

  const categoryPieOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(13, 27, 42, 0.9)',
      borderColor: 'rgba(245, 197, 24, 0.3)',
      borderWidth: 1,
      textStyle: { color: '#fff', fontSize: 11 },
      formatter: '{b}: ₹{c} ({d}%)'
    },
    legend: {
      bottom: '2%',
      left: 'center',
      textStyle: { color: '#9ca3af', fontSize: 10 }
    },
    series: [
      {
        name: 'Contribution Share',
        type: 'pie',
        radius: ['45%', '70%'],
        avoidLabelOverlap: false,
        padAngle: 3,
        itemStyle: { borderRadius: 10, borderColor: '#0a0f1d', borderWidth: 2 },
        label: { show: false, position: 'center' },
        emphasis: {
          label: { show: true, fontSize: 14, fontWeight: 'bold', formatter: '{b}\n{d}%', color: '#fff' }
        },
        labelLine: { show: false },
        data: comparisonData?.categoryComparison?.categories?.map(c => ({
          value: c.year2Val,
          name: c.name,
          itemStyle: { color: c.color }
        })) || []
      }
    ]
  };

  const categoryBarOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(13, 27, 42, 0.9)',
      borderColor: 'rgba(245, 197, 24, 0.3)',
      textStyle: { color: '#fff', fontSize: 11 }
    },
    legend: {
      textStyle: { color: '#9ca3af', fontSize: 11 }
    },
    grid: { left: '3%', right: '4%', bottom: '8%', top: '15%', containLabel: true },
    xAxis: {
      type: 'category',
      data: comparisonData?.categoryComparison?.categories?.map(c => c.name) || [],
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      axisLabel: { color: '#9ca3af', fontSize: 11 }
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      axisLabel: { color: '#9ca3af', formatter: (val) => val >= 100000 ? `₹${(val / 100000).toFixed(1)}L` : `₹${val.toLocaleString('en-IN')}` }
    },
    series: [
      {
        name: comparisonData?.year1?.label || 'Base Year',
        type: 'bar',
        barGap: '10%',
        itemStyle: {
          color: '#1e3a8a',
          borderRadius: [4, 4, 0, 0]
        },
        data: comparisonData?.categoryComparison?.categories?.map(c => c.year1Val) || []
      },
      {
        name: comparisonData?.year2?.label || 'Comparison Year',
        type: 'bar',
        itemStyle: {
          color: '#f5c518',
          borderRadius: [4, 4, 0, 0]
        },
        data: comparisonData?.categoryComparison?.categories?.map(c => c.year2Val) || []
      }
    ]
  };

  return (
    <div className="p-6 space-y-6">
      {/* Title */}
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-3xl font-bold text-white">
            Annual <span className="gold-gradient-text">Comparison</span>
          </h1>
          {(!selectedModule || selectedModule.code === 'all') && (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border"
              style={{ color: '#d4af37', borderColor: '#d4af3744', background: '#d4af3718' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#d4af37' }} />
              Scope: All Collections
            </span>
          )}
        </div>
        <p className="text-gray-400 text-sm mt-1">
          Perform relative analysis and track progress differences between reporting financial years
        </p>
      </div>

      {/* Selectors panel */}
      <div className="glass-card rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-4 w-full md:w-auto">
          <div className="flex-1 md:w-64">
            <label className="text-xs text-gray-500 font-bold uppercase tracking-wider block mb-1.5">Base Year</label>
            <select
              value={year1}
              onChange={(e) => setYear1(e.target.value)}
              className="w-full bg-[#0d1b2a]/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-gold transition-colors duration-200"
            >
              <option value="">Select Base Year</option>
              {financialYears.filter(fy => fy._id !== 'all').map(fy => (
                <option key={fy._id} value={fy._id}>{fy.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-center p-3 bg-white/5 border border-white/10 rounded-xl text-gold shrink-0 mt-5">
            <ArrowRight className="w-5 h-5" />
          </div>
          <div className="flex-1 md:w-64">
            <label className="text-xs text-gray-500 font-bold uppercase tracking-wider block mb-1.5">Comparison Year</label>
            <select
              value={year2}
              onChange={(e) => setYear2(e.target.value)}
              className="w-full bg-[#0d1b2a]/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-gold transition-colors duration-200"
            >
              <option value="">Select Comparison Year</option>
              {financialYears.filter(fy => fy._id !== 'all').map(fy => (
                <option key={fy._id} value={fy._id}>{fy.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="text-gray-500 flex items-center space-x-2 shrink-0">
          <GitCompare className="w-6 h-6 text-gold/60" />
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Relative Delta Index</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold" />
        </div>
      ) : comparisonData ? (
        <div className="space-y-6 animate-fadeIn pb-12">
          {/* Delta KPI Dashboard */}
          {(!selectedModule || selectedModule.code === 'all') ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="glass-card rounded-2xl p-6">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Base Year Total</p>
                <h3 className="text-2xl font-bold text-white mt-1">
                  <AnimatedCounter value={comparisonData.year1.total} formatAsCurrency={true} />
                </h3>
                <p className="text-xs text-gray-400 mt-1">{comparisonData.year1.label}</p>
              </div>
              <div className="glass-card rounded-2xl p-6">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Comp Year Total</p>
                <h3 className="text-2xl font-bold text-white mt-1">
                  <AnimatedCounter value={comparisonData.year2.total} formatAsCurrency={true} />
                </h3>
                <p className="text-xs text-gray-400 mt-1">{comparisonData.year2.label}</p>
              </div>
              <div className="glass-card rounded-2xl p-6 border-l-4" style={{ borderColor: comparisonData.categoryComparison?.highest?.color || '#d4af37' }}>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">🏆 Highest Category</p>
                <h4 className="text-lg font-bold text-white mt-2 truncate">{comparisonData.categoryComparison?.highest?.name || '—'}</h4>
                <p className="text-2xl font-extrabold mt-1" style={{ color: comparisonData.categoryComparison?.highest?.color || '#d4af37' }}>
                  ₹{(comparisonData.categoryComparison?.highest?.year2Val || 0).toLocaleString('en-IN')}
                </p>
                <p className="text-xs text-gray-500 mt-1">{comparisonData.categoryComparison?.highest?.contributionPct || 0}% contribution</p>
              </div>
              <div className="glass-card rounded-2xl p-6 border-l-4 border-l-rose-500/50">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">⚠ Lowest Category</p>
                <h4 className="text-lg font-bold text-white mt-2 truncate">{comparisonData.categoryComparison?.lowest?.name || '—'}</h4>
                <p className="text-2xl font-extrabold text-rose-400 mt-1">
                  ₹{(comparisonData.categoryComparison?.lowest?.year2Val || 0).toLocaleString('en-IN')}
                </p>
                <p className="text-xs text-gray-500 mt-1">{comparisonData.categoryComparison?.lowest?.contributionPct || 0}% contribution</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="glass-card rounded-2xl p-6">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Base Year Total</p>
                <h3 className="text-2xl font-bold text-white mt-1">
                  <AnimatedCounter value={comparisonData.year1.total} formatAsCurrency={true} />
                </h3>
                <p className="text-xs text-gray-400 mt-1">{comparisonData.year1.label}</p>
              </div>
              <div className="glass-card rounded-2xl p-6">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Comp Year Total</p>
                <h3 className="text-2xl font-bold text-white mt-1">
                  <AnimatedCounter value={comparisonData.year2.total} formatAsCurrency={true} />
                </h3>
                <p className="text-xs text-gray-400 mt-1">{comparisonData.year2.label}</p>
              </div>
              <div className="glass-card rounded-2xl p-6">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Amount Delta</p>
                <h3 className={`text-2xl font-bold mt-1 ${comparisonData.diff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  <AnimatedCounter value={comparisonData.diff} formatAsCurrency={true} prefix={comparisonData.diff >= 0 ? '+' : ''} />
                </h3>
                <p className="text-xs text-gray-400 mt-1">Difference Index</p>
              </div>
              <div className="glass-card rounded-2xl p-6">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Growth Index</p>
                <h3 className={`text-2xl font-bold mt-1 ${comparisonData.growthPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  <AnimatedCounter value={comparisonData.growthPct} formatAsCurrency={false} suffix="%" prefix={comparisonData.growthPct >= 0 ? '+' : ''} />
                </h3>
                <p className="text-xs text-gray-400 mt-1">Percentage Change</p>
              </div>
            </div>
          )}

          {/* Render charts/tables conditionally */}
          {(!selectedModule || selectedModule.code === 'all') ? (
            <>
              {/* Category Share Table and Pie Chart */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Table */}
                <div className="glass-card rounded-2xl p-6">
                  <h3 className="text-lg font-bold text-white flex items-center mb-5">
                    <Layers className="w-5 h-5 mr-2 text-gold" />
                    Collection Categories Comparison
                  </h3>
                  <div className="overflow-x-auto rounded-xl border border-white/10 no-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[400px]">
                      <thead>
                        <tr className="bg-white/5 text-gray-400 text-xs font-bold uppercase border-b border-white/10">
                          <th className="p-4">Category</th>
                          <th className="p-4 text-right">{comparisonData.year1.label}</th>
                          <th className="p-4 text-right">{comparisonData.year2.label}</th>
                          <th className="p-4 text-right">Growth %</th>
                          <th className="p-4 text-right">Share</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-sm text-gray-300">
                        {comparisonData.categoryComparison?.categories?.map((cat) => (
                          <tr key={cat.code} className="hover:bg-white/5 transition-colors">
                            <td className="p-4 font-bold text-white flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                              <div>
                                <div>{cat.name}</div>
                                <div className="text-[10px] text-gray-500 uppercase font-semibold">{cat.code}</div>
                              </div>
                            </td>
                            <td className="p-4 text-right font-semibold">₹{cat.year1Val.toLocaleString('en-IN')}</td>
                            <td className="p-4 text-right font-extrabold text-white">₹{cat.year2Val.toLocaleString('en-IN')}</td>
                            <td className="p-4 text-right font-bold">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-extrabold ${cat.growthPct >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                {cat.growthPct >= 0 ? '+' : ''}{cat.growthPct}%
                              </span>
                            </td>
                            <td className="p-4 text-right font-semibold">
                              <div className="flex items-center justify-end gap-2">
                                <span>{cat.contributionPct}%</span>
                                <div className="w-16 bg-white/5 rounded-full h-1.5 hidden sm:block">
                                  <div className="h-1.5 rounded-full" style={{ width: `${cat.contributionPct}%`, backgroundColor: cat.color }} />
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pie Chart */}
                <div className="glass-card rounded-2xl p-6">
                  <h3 className="text-lg font-bold text-white flex items-center mb-5">
                    <PieChart className="w-5 h-5 mr-2 text-gold" />
                    Contribution Share ({comparisonData.year2.label})
                  </h3>
                  <div className="h-72">
                    <EChartWrapper option={categoryPieOption} />
                  </div>
                </div>
              </div>

              {/* Category Bar Chart */}
              <div className="glass-card rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white flex items-center mb-4">
                  <BarChart2 className="w-5 h-5 mr-2 text-gold" />
                  Category Annual Growth Comparison
                </h3>
                <div className="h-96">
                  <EChartWrapper option={categoryBarOption} />
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Grouped Bar Chart */}
              <div className="glass-card rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                  <BarChart2 className="w-5 h-5 mr-2 text-gold" />
                  Monthly Comparison Distribution
                </h3>
                <div className="h-96">
                  <EChartWrapper option={chartOption} />
                </div>
              </div>

              {/* Performers Difference Analysis */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Top Growth Contributors */}
                <div className="glass-card rounded-2xl p-6">
                  <h3 className="text-lg font-bold text-emerald-400 flex items-center mb-4">
                    <TrendingUp className="w-5 h-5 mr-2" />
                    Top Growth Contributors
                  </h3>
                  <div className="space-y-4">
                    {performers.growth.length > 0 ? (
                      performers.growth.map(p => (
                        <div key={p.proId} className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold text-white text-sm">{p.name}</h4>
                            <p className="text-xs text-gray-400 mt-1">
                              Base: ₹{p.prev.toLocaleString('en-IN')} → Comp: ₹{p.curr.toLocaleString('en-IN')}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-bold text-emerald-400 block">+₹{p.diff.toLocaleString('en-IN')}</span>
                            <span className="text-xs text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full font-semibold">+{p.pct}%</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-400 text-center py-4">No growing contributors found</p>
                    )}
                  </div>
                </div>

                {/* Top Declining Contributors */}
                <div className="glass-card rounded-2xl p-6">
                  <h3 className="text-lg font-bold text-rose-400 flex items-center mb-4">
                    <TrendingDown className="w-5 h-5 mr-2" />
                    Top Declining Contributors
                  </h3>
                  <div className="space-y-4">
                    {performers.decline.length > 0 ? (
                      performers.decline.map(p => (
                        <div key={p.proId} className="p-4 bg-rose-500/5 border border-rose-500/10 rounded-xl flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold text-white text-sm">{p.name}</h4>
                            <p className="text-xs text-gray-400 mt-1">
                              Base: ₹{p.prev.toLocaleString('en-IN')} → Comp: ₹{p.curr.toLocaleString('en-IN')}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-bold text-rose-400 block">₹{p.diff.toLocaleString('en-IN')}</span>
                            <span className="text-xs text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full font-semibold">{p.pct}%</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-400 text-center py-4">No declining contributors found</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="glass-card rounded-2xl p-12 text-center text-gray-400 text-sm">
          Please configure your Base Year and Comparison Year above to render differences.
        </div>
      )}
    </div>
  );
};

export default Comparison;
