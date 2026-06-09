import React, { useEffect, useState } from 'react';

const AnimatedCounter = ({ value, duration = 800, prefix = '', suffix = '', formatAsCurrency = false }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTimestamp = null;
    const endValue = Number(value) || 0;
    const startValue = 0;

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const currentCount = progress * (endValue - startValue) + startValue;
      setCount(currentCount);

      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setCount(endValue);
      }
    };

    window.requestAnimationFrame(step);
  }, [value, duration]);

  const formatNumber = (num) => {
    if (formatAsCurrency) {
      return num.toLocaleString('en-IN', {
        maximumFractionDigits: 0,
      });
    }
    return Math.round(num).toLocaleString();
  };

  return (
    <span>
      {prefix}
      {formatNumber(count)}
      {suffix}
    </span>
  );
};

export default AnimatedCounter;
