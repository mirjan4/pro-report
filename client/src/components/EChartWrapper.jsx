import React, { useRef, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';

const EChartWrapper = ({ option, style, loading = false, onEvents }) => {
  const chartRef = useRef(null);

  // Resize chart when window dimensions change
  useEffect(() => {
    const handleResize = () => {
      if (chartRef.current) {
        const echartsInstance = chartRef.current.getEchartsInstance();
        echartsInstance.resize();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="relative w-full h-full min-h-[300px]">
      {loading && (
        <div className="absolute inset-0 bg-dark-bg/50 backdrop-blur-sm flex items-center justify-center z-10 rounded-xl">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-gold" />
        </div>
      )}
      <ReactECharts
        ref={chartRef}
        option={option}
        style={{ width: '100%', height: '100%', minHeight: '300px', ...style }}
        theme="dark-theme"
        onEvents={onEvents}
        notMerge={true}
        lazyUpdate={true}
      />
    </div>
  );
};

export default EChartWrapper;
