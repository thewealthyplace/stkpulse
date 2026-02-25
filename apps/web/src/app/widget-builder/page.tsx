'use client';

import { useState } from 'react';

type WidgetType = 'stx-price' | 'contract-calls' | 'stacking-cycle' | 'token-price' | 'tvl' | 'nft-floor';

export default function WidgetBuilder() {
  const [widgetType, setWidgetType] = useState<WidgetType>('stx-price');
  const [theme, setTheme] = useState('dark');
  const [period, setPeriod] = useState('30d');
  const [width, setWidth] = useState('600');
  const [height, setHeight] = useState('300');
  const [contract, setContract] = useState('');
  const [protocol, setProtocol] = useState('');
  const [collection, setCollection] = useState('');
  const [embedType, setEmbedType] = useState<'script' | 'iframe'>('script');

  const generateScriptTag = () => {
    let attrs = `data-widget="${widgetType}" data-theme="${theme}" data-period="${period}" data-width="${width}" data-height="${height}"`;
    
    if (contract && (widgetType === 'contract-calls' || widgetType === 'token-price')) {
      attrs += ` data-contract="${contract}"`;
    }
    if (protocol && widgetType === 'tvl') {
      attrs += ` data-protocol="${protocol}"`;
    }
    if (collection && widgetType === 'nft-floor') {
      attrs += ` data-collection="${collection}"`;
    }

    return `<script src="https://stkpulse.io/embed.js" ${attrs}></script>`;
  };

  const generateIframe = () => {
    let url = `https://stkpulse.io/widget/${widgetType}?theme=${theme}&period=${period}`;
    
    if (contract && (widgetType === 'contract-calls' || widgetType === 'token-price')) {
      url += `&contract=${contract}`;
    }
    if (protocol && widgetType === 'tvl') {
      url += `&protocol=${protocol}`;
    }
    if (collection && widgetType === 'nft-floor') {
      url += `&collection=${collection}`;
    }

    return `<iframe src="${url}" width="${width}" height="${height}" frameborder="0"></iframe>`;
  };

  const embedCode = embedType === 'script' ? generateScriptTag() : generateIframe();

  const copyToClipboard = () => {
    navigator.clipboard.writeText(embedCode);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
      <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '8px' }}>Widget Builder</h1>
      <p style={{ color: '#666', marginBottom: '40px' }}>
        Create embeddable charts for your website or dApp
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '20px' }}>Configuration</h2>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Widget Type</label>
            <select 
              value={widgetType} 
              onChange={(e) => setWidgetType(e.target.value as WidgetType)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            >
              <option value="stx-price">STX Price</option>
              <option value="contract-calls">Contract Calls</option>
              <option value="stacking-cycle">Stacking Cycle</option>
              <option value="token-price">Token Price</option>
              <option value="tvl">TVL</option>
              <option value="nft-floor">NFT Floor</option>
            </select>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Theme</label>
            <select 
              value={theme} 
              onChange={(e) => setTheme(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="auto">Auto</option>
            </select>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Period</label>
            <select 
              value={period} 
              onChange={(e) => setPeriod(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            >
              <option value="24h">24 Hours</option>
              <option value="7d">7 Days</option>
              <option value="30d">30 Days</option>
              <option value="1y">1 Year</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Width</label>
              <input 
                type="text" 
                value={width} 
                onChange={(e) => setWidth(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Height</label>
              <input 
                type="text" 
                value={height} 
                onChange={(e) => setHeight(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>
          </div>

          {(widgetType === 'contract-calls' || widgetType === 'token-price') && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Contract ID</label>
              <input 
                type="text" 
                value={contract} 
                onChange={(e) => setContract(e.target.value)}
                placeholder="SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-token"
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>
          )}

          {widgetType === 'tvl' && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Protocol</label>
              <input 
                type="text" 
                value={protocol} 
                onChange={(e) => setProtocol(e.target.value)}
                placeholder="alex"
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>
          )}

          {widgetType === 'nft-floor' && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Collection</label>
              <input 
                type="text" 
                value={collection} 
                onChange={(e) => setCollection(e.target.value)}
                placeholder="SP2KAF9RF86PVX3NEE27DFV1CQX0T4WGR41X3S45C.bitcoin-monkeys"
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Embed Type</label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setEmbedType('script')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '4px',
                  border: embedType === 'script' ? '2px solid #5546ff' : '1px solid #ddd',
                  background: embedType === 'script' ? '#f0f0ff' : 'white',
                  cursor: 'pointer'
                }}
              >
                Script Tag
              </button>
              <button
                onClick={() => setEmbedType('iframe')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '4px',
                  border: embedType === 'iframe' ? '2px solid #5546ff' : '1px solid #ddd',
                  background: embedType === 'iframe' ? '#f0f0ff' : 'white',
                  cursor: 'pointer'
                }}
              >
                iframe
              </button>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Embed Code</label>
            <textarea 
              value={embedCode}
              readOnly
              style={{ 
                width: '100%', 
                padding: '12px', 
                borderRadius: '4px', 
                border: '1px solid #ddd',
                fontFamily: 'monospace',
                fontSize: '12px',
                minHeight: '100px',
                resize: 'vertical'
              }}
            />
            <button
              onClick={copyToClipboard}
              style={{
                marginTop: '8px',
                padding: '10px 20px',
                borderRadius: '4px',
                border: 'none',
                background: '#5546ff',
                color: 'white',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Copy to Clipboard
            </button>
          </div>
        </div>

        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '20px' }}>Preview</h2>
          <div 
            style={{ 
              border: '1px solid #ddd', 
              borderRadius: '8px', 
              padding: '20px',
              background: '#f9f9f9'
            }}
          >
            <div style={{ 
              width: width === 'auto' ? '100%' : `${width}px`, 
              height: `${height}px`,
              background: theme === 'dark' ? '#1a1a1a' : '#ffffff',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: theme === 'dark' ? '#e0e0e0' : '#333333'
            }}>
              Widget Preview ({widgetType})
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
