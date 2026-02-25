// embed.js - Script tag widget loader

(function() {
  'use strict';

  const API_BASE = 'https://api.stkpulse.com/api/v1';

  function getConfig(script) {
    return {
      type: script.dataset.widget,
      theme: script.dataset.theme || 'auto',
      period: script.dataset.period || '30d',
      width: script.dataset.width || 'auto',
      height: parseInt(script.dataset.height) || 300,
      accentColor: script.dataset.accentColor || '#5546ff',
      showLegend: script.dataset.showLegend !== 'false',
      showGrid: script.dataset.showGrid !== 'false',
      contract: script.dataset.contract,
      currency: script.dataset.currency || 'USD',
      protocol: script.dataset.protocol,
      collection: script.dataset.collection,
    };
  }

  function detectTheme(theme) {
    if (theme === 'auto') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme;
  }

  function createContainer(config) {
    const container = document.createElement('div');
    container.className = 'stkpulse-widget';
    container.style.width = config.width === 'auto' ? '100%' : config.width + 'px';
    container.style.height = config.height + 'px';
    container.style.position = 'relative';
    container.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    return container;
  }

  async function fetchWidgetData(config) {
    let url = `${API_BASE}/widget/${config.type}?period=${config.period}`;
    
    if (config.contract) url += `&contract=${config.contract}`;
    if (config.currency) url += `&currency=${config.currency}`;
    if (config.protocol) url += `&protocol=${config.protocol}`;
    if (config.collection) url += `&collection=${config.collection}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch widget data');
    return response.json();
  }

  function renderChart(container, data, config) {
    const theme = detectTheme(config.theme);
    const bgColor = theme === 'dark' ? '#1a1a1a' : '#ffffff';
    const textColor = theme === 'dark' ? '#e0e0e0' : '#333333';
    const gridColor = theme === 'dark' ? '#333333' : '#e0e0e0';

    container.style.backgroundColor = bgColor;
    container.style.color = textColor;
    container.style.padding = '16px';
    container.style.borderRadius = '8px';
    container.style.boxSizing = 'border-box';

    const canvas = document.createElement('canvas');
    canvas.width = container.offsetWidth - 32;
    canvas.height = container.offsetHeight - 32;
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    drawLineChart(ctx, data, config, { textColor, gridColor });
  }

  function drawLineChart(ctx, widgetData, config, colors) {
    const { data } = widgetData;
    let points = [];

    if (config.type === 'stx-price' || config.type === 'token-price') {
      points = data.prices.map(p => ({ x: new Date(p.timestamp).getTime(), y: parseFloat(p.price) }));
    } else if (config.type === 'contract-calls') {
      points = data.calls.map(c => ({ x: new Date(c.timestamp).getTime(), y: parseInt(c.calls) }));
    } else if (config.type === 'tvl') {
      points = data.tvl.map(t => ({ x: new Date(t.timestamp).getTime(), y: parseFloat(t.tvl) }));
    } else if (config.type === 'nft-floor') {
      points = data.floors.map(f => ({ x: new Date(f.timestamp).getTime(), y: parseFloat(f.floor_price) }));
    }

    if (points.length === 0) {
      ctx.fillStyle = colors.textColor;
      ctx.font = '14px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('No data available', ctx.canvas.width / 2, ctx.canvas.height / 2);
      return;
    }

    const padding = 40;
    const width = ctx.canvas.width - padding * 2;
    const height = ctx.canvas.height - padding * 2;

    const minY = Math.min(...points.map(p => p.y));
    const maxY = Math.max(...points.map(p => p.y));
    const minX = points[0].x;
    const maxX = points[points.length - 1].x;

    if (config.showGrid) {
      ctx.strokeStyle = colors.gridColor;
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const y = padding + (height / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(padding + width, y);
        ctx.stroke();
      }
    }

    ctx.strokeStyle = config.accentColor;
    ctx.lineWidth = 2;
    ctx.beginPath();

    points.forEach((point, i) => {
      const x = padding + ((point.x - minX) / (maxX - minX)) * width;
      const y = padding + height - ((point.y - minY) / (maxY - minY)) * height;
      
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();

    if (config.showLegend) {
      ctx.fillStyle = colors.textColor;
      ctx.font = 'bold 18px system-ui';
      ctx.textAlign = 'left';
      const currentValue = points[points.length - 1].y.toFixed(2);
      ctx.fillText(`$${currentValue}`, padding, padding - 10);
    }
  }

  function renderStackingCycle(container, data, config) {
    const theme = detectTheme(config.theme);
    const bgColor = theme === 'dark' ? '#1a1a1a' : '#ffffff';
    const textColor = theme === 'dark' ? '#e0e0e0' : '#333333';

    container.style.backgroundColor = bgColor;
    container.style.color = textColor;
    container.style.padding = '20px';
    container.style.borderRadius = '8px';

    if (!data.data) {
      container.innerHTML = '<p>No stacking cycle data available</p>';
      return;
    }

    const cycle = data.data;
    container.innerHTML = `
      <div style="font-size: 24px; font-weight: bold; margin-bottom: 16px;">
        Cycle #${cycle.cycle_number}
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 14px;">
        <div>
          <div style="opacity: 0.7;">Total Stacked</div>
          <div style="font-weight: bold;">${(cycle.total_stacked / 1e6).toFixed(2)}M STX</div>
        </div>
        <div>
          <div style="opacity: 0.7;">BTC Committed</div>
          <div style="font-weight: bold;">${cycle.btc_committed} BTC</div>
        </div>
        <div>
          <div style="opacity: 0.7;">Blocks Remaining</div>
          <div style="font-weight: bold;">${cycle.blocks_remaining}</div>
        </div>
      </div>
    `;
  }

  async function initWidget(script) {
    try {
      const config = getConfig(script);
      const container = createContainer(config);
      script.parentNode.insertBefore(container, script.nextSibling);

      const data = await fetchWidgetData(config);

      if (config.type === 'stacking-cycle') {
        renderStackingCycle(container, data, config);
      } else {
        renderChart(container, data, config);
      }
    } catch (error) {
      console.error('StkPulse Widget Error:', error);
    }
  }

  const scripts = document.querySelectorAll('script[data-widget]');
  scripts.forEach(script => initWidget(script));
})();
