import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import client from '../api/client';
import EChartWrapper from '../components/EChartWrapper';
import { BarChart3, PieChart, LineChart, Award, TrendingDown, ArrowUp } from 'lucide-react';

const Analytics = () => {
  const { selectedFY, selectedModule } = useApp();
  const [monthlyData, setMonthlyData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [highestMonth, setHighestMonth] = useState(null);
  const [lowestMonth, setLowestMonth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedFY?._id) return;
      setLoading(true);
      try {
        const modParam = selectedModule && selectedModule.code !== 'all' ? `&module=${selectedModule._id}` : '';
        const [monthlyRes, categoryRes] = await Promise.all([
          client.get(`/api/analytics/monthly?financialYear=${selectedFY._id}${modParam}`),
          client.get(`/api/analytics/category?financialYear=${selectedFY._id}`)
        ]);

        if (monthlyRes.data.success) {
          const mData = monthlyRes.data.data.monthlyData || [];
          setMonthlyData(mData);
          setHighestMonth(monthlyRes.data.data.highestMonth);
          setLowestMonth(monthlyRes.data.data.lowestMonth);
        }
        if (categoryRes.data.success) {
          setCategoryData(categoryRes.data.data);
        }
      } catch (err) {
        console.error('Failed to load analytics data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedFY, selectedModule]);

  // 3D-styled Line Chart Option
  const lineChartOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(13, 27, 42, 0.9)',
      borderColor: 'rgba(245, 197, 24, 0.3)',
      textStyle: { color: '#fff' }
    },
    toolbox: {
      feature: {
        saveAsImage: {
          show: true,
          title: 'Export Image',
          pixelRatio: 2,
          iconStyle: { borderColor: '#f5c518' }
        }
      },
      right: '5%'
    },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
    xAxis: {
      type: 'category',
      data: monthlyData.map(m => m.month),
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
        name: 'Monthly Total',
        type: 'line',
        smooth: true,
        showSymbol: true,
        symbolSize: 8,
        itemStyle: { color: '#f5c518' },
        lineStyle: {
          width: 4,
          shadowBlur: 15,
          shadowColor: 'rgba(245, 197, 24, 0.5)',
          shadowOffsetY: 5
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(245, 197, 24, 0.3)' },
              { offset: 1, color: 'transparent' }
            ]
          }
        },
        markPoint: {
          data: [
            { type: 'max', name: 'Max', itemStyle: { color: '#10b981' } },
            { type: 'min', name: 'Min', itemStyle: { color: '#ef4444' } }
          ],
          label: { color: '#fff', fontSize: 10 }
        },
        data: monthlyData.map(m => m.total)
      }
    ]
  };

  // Pie Chart for module breakdown
  const pieChartOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: '{b}: ₹{c} ({d}%)',
      backgroundColor: 'rgba(13, 27, 42, 0.9)',
      borderColor: 'rgba(245, 197, 24, 0.3)',
      textStyle: { color: '#fff' }
    },
    legend: { orient: 'vertical', right: '5%', top: 'center', textStyle: { color: '#9ca3af' } },
    series: [{
      name: 'Module Contribution',
      type: 'pie',
      radius: ['45%', '75%'],
      center: ['40%', '50%'],
      roseType: 'radius',
      itemStyle: { borderRadius: 8, borderColor: '#0a0f1d', borderWidth: 2, shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' },
      label: { show: true, color: '#e5e7eb', formatter: '{b}: {d}%' },
      data: categoryData.map(c => ({ value: c.value, name: c.name, itemStyle: { color: c.color || '#f5c518' } }))
    }]
  };

  // Monthly Bar Chart
  const barChartOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(13, 27, 42, 0.9)',
      borderColor: 'rgba(245, 197, 24, 0.3)',
      textStyle: { color: '#fff' }
    },
    toolbox: { feature: { saveAsImage: { show: true, title: 'Export PNG', pixelRatio: 2, iconStyle: { borderColor: '#f5c518' } } }, right: '5%' },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
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
      axisLabel: { color: '#9ca3af', formatter: v => v >= 100000 ? `${(v/100000).toFixed(1)}L` : v }
    },
    series: [{
      name: selectedModule?.name || 'Total',
      type: 'bar',
      barWidth: '50%',
      itemStyle: {
        color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
          { offset: 0, color: selectedModule?.color || '#f5c518' },
          { offset: 1, color: (selectedModule?.color || '#f5c518') + '55' }
        ]},
        borderRadius: [6, 6, 0, 0],
        shadowBlur: 8, shadowColor: (selectedModule?.color || '#f5c518') + '44'
      },
      data: monthlyData.map(m => m.total)
    }]
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
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-3xl font-bold text-white">
            Collection <span className="gold-gradient-text">Analysis</span>
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
          Detailed visual breakdown of collections for {selectedFY?.label}
        </p>
      </div>

      {/* Row 1: Line Chart & KPI Highlight */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center">
              <LineChart className="w-5 h-5 mr-2 text-gold" />
              Monthly Total Collection
            </h3>
          </div>
          <div className="h-80">
            <EChartWrapper option={lineChartOption} />
          </div>
        </div>

        {/* Highlights */}
        <div className="space-y-6 flex flex-col justify-between">
          {highestMonth && (
            <div className="glass-card rounded-2xl p-6 relative overflow-hidden flex-1 flex flex-col justify-center">
              <div className="absolute top-0 right-0 p-3 bg-emerald-500/10 text-emerald-400 rounded-bl-2xl">
                <ArrowUp className="w-5 h-5" />
              </div>
              <p className="text-xs font-medium text-emerald-400 uppercase tracking-widest">Peak Month</p>
              <h3 className="text-2xl font-bold text-white mt-1">{highestMonth.month}</h3>
              <p className="text-3xl font-extrabold text-gold mt-2">
                ₹{highestMonth.total.toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Recorded highest total collection with {highestMonth.count} entries.
              </p>
            </div>
          )}

          {lowestMonth && (
            <div className="glass-card rounded-2xl p-6 relative overflow-hidden flex-1 flex flex-col justify-center">
              <div className="absolute top-0 right-0 p-3 bg-rose-500/10 text-rose-400 rounded-bl-2xl">
                <TrendingDown className="w-5 h-5" />
              </div>
              <p className="text-xs font-medium text-rose-400 uppercase tracking-widest">Lowest Month</p>
              <h3 className="text-2xl font-bold text-white mt-1">{lowestMonth.month}</h3>
              <p className="text-3xl font-extrabold text-white mt-2">
                ₹{lowestMonth.total.toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Recorded lowest total non-zero collection with {lowestMonth.count} entries.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Category Pie & Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center">
              <PieChart className="w-5 h-5 mr-2 text-gold" />
              Category Contribution Share
            </h3>
          </div>
          <div className="h-80">
            <EChartWrapper option={pieChartOption} />
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center">
              <BarChart3 className="w-5 h-5 mr-2 text-gold" />
              Monthly Comparison (Grouped)
            </h3>
          </div>
          <div className="h-80">
            <EChartWrapper option={barChartOption} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
