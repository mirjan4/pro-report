import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import client from '../api/client';
import KPICard from '../components/KPICard';
import EChartWrapper from '../components/EChartWrapper';
import {
  Coins,
  Globe,
  UserCheck,
  Building,
  Percent,
  TrendingUp,
  Award,
  AlertTriangle
} from 'lucide-react';
import { motion } from 'framer-motion';

const Dashboard = () => {
  const { selectedFY, selectedModule } = useApp();
  const [kpiData, setKpiData] = useState(null);
  const [monthlyData, setMonthlyData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [topPerformers, setTopPerformers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedFY?._id) return;
      setLoading(true);
      try {
        const modParam = selectedModule ? `&module=${selectedModule._id}` : '';
        const [kpiRes, monthlyRes, rankingsRes, catRes] = await Promise.all([
          client.get(`/api/analytics/kpi?financialYear=${selectedFY._id}${modParam}`),
          client.get(`/api/analytics/monthly?financialYear=${selectedFY._id}${modParam}`),
          client.get(`/api/analytics/rankings?financialYear=${selectedFY._id}${modParam}`),
          client.get(`/api/analytics/category?financialYear=${selectedFY._id}`)
        ]);

        if (kpiRes.data.success) setKpiData(kpiRes.data.data);
        if (monthlyRes.data.success) setMonthlyData(monthlyRes.data.data.monthlyData || []);
        if (rankingsRes.data.success) setTopPerformers(rankingsRes.data.data.rankings?.slice(0, 3) || []);
        if (catRes.data.success) setCategoryData(catRes.data.data);
      } catch (err) {
        console.error('Failed to load dashboard data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedFY, selectedModule]);

  const overviewChartOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(13, 27, 42, 0.9)',
      borderColor: 'rgba(245, 197, 24, 0.3)',
      textStyle: { color: '#fff' },
      axisPointer: { type: 'shadow' }
    },
    grid: { left: '3%', right: '3%', bottom: '3%', top: '10%', containLabel: true },
    xAxis: {
      type: 'category',
      data: monthlyData.map(m => m.month.substring(0, 3)),
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      axisLabel: { color: '#9ca3af' }
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      axisLabel: {
        color: '#9ca3af',
        formatter: (val) => val >= 100000 ? `${(val / 100000).toFixed(1)}L` : val
      }
    },
    series: [
      {
        name: 'Total Collection',
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
        data: monthlyData.map(m => m.total)
      }
    ]
  };

  const contributionChartOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: '{b}: ₹{c} ({d}%)',
      backgroundColor: 'rgba(13, 27, 42, 0.9)',
      borderColor: 'rgba(245, 197, 24, 0.3)',
      textStyle: { color: '#fff' }
    },
    legend: {
      bottom: '5%',
      left: 'center',
      textStyle: { color: '#9ca3af' }
    },
    series: [
      {
        name: 'Modules',
        type: 'pie',
        radius: ['50%', '70%'],
        avoidLabelOverlap: false,
        padAngle: 3,
        itemStyle: { borderRadius: 10 },
        label: { show: false, position: 'center' },
        emphasis: {
          label: { show: true, fontSize: 16, fontWeight: 'bold', formatter: '{b}\n{d}%', color: '#fff' }
        },
        labelLine: { show: false },
        data: categoryData.map(c => ({ value: c.value, name: c.name, itemStyle: { color: c.color } }))
      }
    ]
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Top Welcome Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Collection <span className="gold-gradient-text">Overview</span>
          </h1>
          <div className="flex items-center gap-2 mt-1">
            {selectedModule && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border"
                style={{ color: selectedModule.color, borderColor: selectedModule.color + '44', background: selectedModule.color + '18' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: selectedModule.color }} />
                {selectedModule.name}
              </span>
            )}
            <p className="text-gray-400 text-sm">Financial analytics — {selectedFY?.label}</p>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard title="Total Collection" value={kpiData?.total || 0} icon={Coins}
          trend={kpiData?.growthPct >= 0 ? 'up' : 'down'} trendValue={Math.abs(kpiData?.growthPct || 0)} subtitle="This FY" />
        <KPICard title="Previous Year" value={kpiData?.prevTotal || 0} icon={TrendingUp}
          trend={kpiData?.growthPct >= 0 ? 'up' : 'down'} trendValue={Math.abs(kpiData?.growthPct || 0)} subtitle="Last FY" />
        <KPICard title="Contributing PROs" value={kpiData?.contributingPros || 0} icon={UserCheck}
          isCurrency={false} subtitle={`of ${kpiData?.activePros || 0} active`} />
        <KPICard title="Growth" value={kpiData?.growthPct || 0} icon={Percent}
          trend={kpiData?.growthPct >= 0 ? 'up' : 'down'} trendValue={Math.abs(kpiData?.growthPct || 0)}
          isCurrency={false} suffix="%" subtitle="vs Previous Year" />
      </div>

      {/* Charts & Mini-Rankings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Collection Trend */}
        <div className="lg:col-span-2 glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-gold" />
              Monthly Collection Trend
            </h3>
          </div>
          <div className="h-80">
            <EChartWrapper option={overviewChartOption} />
          </div>
        </div>

        {/* Contribution Breakdown */}
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center">
              <Coins className="w-5 h-5 mr-2 text-gold" />
              Contribution Share
            </h3>
          </div>
          <div className="h-80">
            <EChartWrapper option={contributionChartOption} />
          </div>
        </div>
      </div>

      {/* Top Performers and Zero Contributors alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Performers Card */}
        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white flex items-center mb-4">
            <Award className="w-5 h-5 mr-2 text-gold" />
            Top Growth Contributors
          </h3>
          <div className="space-y-4">
            {topPerformers.length > 0 ? (
              topPerformers.map((p, idx) => (
                <div key={p.proId} className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                  <div className="flex items-center space-x-3">
                    <span className="text-xl">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                    </span>
                    <div>
                      <h4 className="font-semibold text-white text-sm">{p.name}</h4>
                      <p className="text-xs text-gray-400">Rank {p.rank}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gold text-sm">₹{p.total.toLocaleString('en-IN')}</p>
                    <p className={`text-xs font-semibold ${p.growth >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {p.growth >= 0 ? '+' : ''}{p.growth}%
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">No top performer data found</p>
            )}
          </div>
        </div>

        {/* Action Center / KPI Alerts */}
        <div className="glass-card rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center mb-4">
              <AlertTriangle className="w-5 h-5 mr-2 text-amber-500" />
              Performance Alerts
            </h3>
            <div className="space-y-3">
              {kpiData?.zeroPros > 0 ? (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-sm">
                  <strong>Critical:</strong> {kpiData.zeroPros} Active PROs have registered zero collections. Immediate action recommended in the Insights tab.
                </div>
              ) : (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-sm">
                  <strong>Healthy:</strong> All active PRO officers are contributing collections this year.
                </div>
              )}
              <div className="p-3 bg-premium-blue/20 border border-premium-light/20 rounded-xl text-blue-300 text-sm">
                <strong>FY Comparison:</strong> Growth indicator is showing{' '}
                <span className={kpiData?.growthPct >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {kpiData?.growthPct >= 0 ? 'positive' : 'negative'} ({kpiData?.growthPct}%)
                </span>{' '}
                progress compared to the previous year.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
