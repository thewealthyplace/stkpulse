'use client';

import { useEffect, useState } from 'react';

export function WidgetRenderer({ config }: { config: any }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        let url = `/api/v1/widget/${config.type}?period=${config.period}`;
        
        if (config.contract) url += `&contract=${config.contract}`;
        if (config.protocol) url += `&protocol=${config.protocol}`;
        if (config.collection) url += `&collection=${config.collection}`;

        const response = await fetch(url);
        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error('Failed to fetch widget data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [config]);

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>;
  }

  if (!data) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>No data available</div>;
  }

  const theme = config.theme === 'auto' 
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : config.theme;

  const bgColor = theme === 'dark' ? '#1a1a1a' : '#ffffff';
  const textColor = theme === 'dark' ? '#e0e0e0' : '#333333';

  return (
    <div style={{ 
      width: '100%', 
      height: '100%', 
      backgroundColor: bgColor, 
      color: textColor,
      padding: '20px',
      boxSizing: 'border-box'
    }}>
      {config.type === 'stacking-cycle' ? (
        <StackingCycleWidget data={data.data} />
      ) : (
        <ChartWidget data={data} config={config} theme={theme} />
      )}
    </div>
  );
}

function StackingCycleWidget({ data }: { data: any }) {
  if (!data) return <div>No cycle data</div>;

  return (
    <div>
      <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>
        Cycle #{data.cycle_number}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
        <div>
          <div style={{ opacity: 0.7 }}>Total Stacked</div>
          <div style={{ fontWeight: 'bold' }}>{(data.total_stacked / 1e6).toFixed(2)}M STX</div>
        </div>
        <div>
          <div style={{ opacity: 0.7 }}>BTC Committed</div>
          <div style={{ fontWeight: 'bold' }}>{data.btc_committed} BTC</div>
        </div>
        <div>
          <div style={{ opacity: 0.7 }}>Blocks Remaining</div>
          <div style={{ fontWeight: 'bold' }}>{data.blocks_remaining}</div>
        </div>
      </div>
    </div>
  );
}

function ChartWidget({ data, config, theme }: { data: any; config: any; theme: string }) {
  let points: { x: number; y: number }[] = [];
  let currentValue = 0;

  if (config.type === 'stx-price' || config.type === 'token-price') {
    points = data.data.prices.map((p: any) => ({ 
      x: new Date(p.timestamp).getTime(), 
      y: parseFloat(p.price) 
    }));
    currentValue = data.data.current;
  } else if (config.type === 'contract-calls') {
    points = data.data.calls.map((c: any) => ({ 
      x: new Date(c.timestamp).getTime(), 
      y: parseInt(c.calls) 
    }));
    currentValue = data.data.total;
  } else if (config.type === 'tvl') {
    points = data.data.tvl.map((t: any) => ({ 
      x: new Date(t.timestamp).getTime(), 
      y: parseFloat(t.tvl) 
    }));
    currentValue = data.data.current;
  } else if (config.type === 'nft-floor') {
    points = data.data.floors.map((f: any) => ({ 
      x: new Date(f.timestamp).getTime(), 
      y: parseFloat(f.floor_price) 
    }));
    currentValue = data.data.current;
  }

  if (points.length === 0) {
    return <div>No data available</div>;
  }

  return (
    <div>
      <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
        ${currentValue.toFixed(2)}
      </div>
      <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '16px' }}>
        {config.period} chart
      </div>
      <svg width="100%" height="200" style={{ display: 'block' }}>
        <SimpleLine points={points} color="#5546ff" />
      </svg>
    </div>
  );
}

function SimpleLine({ points, color }: { points: { x: number; y: number }[]; color: string }) {
  if (points.length === 0) return null;

  const minY = Math.min(...points.map(p => p.y));
  const maxY = Math.max(...points.map(p => p.y));
  const minX = points[0].x;
  const maxX = points[points.length - 1].x;

  const width = 100;
  const height = 100;

  const pathData = points.map((point, i) => {
    const x = ((point.x - minX) / (maxX - minX)) * width;
    const y = height - ((point.y - minY) / (maxY - minY)) * height;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  return (
    <path
      d={pathData}
      fill="none"
      stroke={color}
      strokeWidth="2"
      vectorEffect="non-scaling-stroke"
      style={{ transform: 'scale(1)' }}
    />
  );
}
