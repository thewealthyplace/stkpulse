# Widget Documentation

## Overview
Embed live Stacks blockchain data into your website or dApp with zero backend work.

## Quick Start

### Script Tag (Recommended)
```html
<script
  src="https://stkpulse.io/embed.js"
  data-widget="stx-price"
  data-theme="dark"
  data-period="30d"
  data-width="600"
  data-height="300"
></script>
```

### iframe
```html
<iframe
  src="https://stkpulse.io/widget/stx-price?theme=dark&period=30d"
  width="600"
  height="300"
  frameborder="0"
></iframe>
```

## Available Widgets

### 1. STX Price
Display real-time STX price chart.

**Script Tag:**
```html
<script
  src="https://stkpulse.io/embed.js"
  data-widget="stx-price"
  data-theme="dark"
  data-period="30d"
  data-currency="USD"
></script>
```

**iframe:**
```html
<iframe
  src="https://stkpulse.io/widget/stx-price?theme=dark&period=30d&currency=USD"
  width="600"
  height="300"
  frameborder="0"
></iframe>
```

**Parameters:**
- `period`: `24h`, `7d`, `30d`, `1y`
- `currency`: `USD`, `BTC`, `STX`

---

### 2. Contract Calls
Show function call volume for any contract.

**Script Tag:**
```html
<script
  src="https://stkpulse.io/embed.js"
  data-widget="contract-calls"
  data-contract="SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-token"
  data-period="7d"
></script>
```

**Parameters:**
- `contract`: Full contract ID (required)
- `period`: `24h`, `7d`, `30d`, `1y`

---

### 3. Stacking Cycle
Display current stacking cycle stats.

**Script Tag:**
```html
<script
  src="https://stkpulse.io/embed.js"
  data-widget="stacking-cycle"
  data-theme="dark"
></script>
```

**No additional parameters required.**

---

### 4. Token Price
Show price chart for any SIP-010 token.

**Script Tag:**
```html
<script
  src="https://stkpulse.io/embed.js"
  data-widget="token-price"
  data-contract="SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-token"
  data-period="30d"
></script>
```

**Parameters:**
- `contract`: Token contract ID (required)
- `period`: `24h`, `7d`, `30d`, `1y`

---

### 5. TVL
Display TVL chart for a DeFi protocol.

**Script Tag:**
```html
<script
  src="https://stkpulse.io/embed.js"
  data-widget="tvl"
  data-protocol="alex"
  data-period="30d"
></script>
```

**Parameters:**
- `protocol`: Protocol name (required) - `alex`, `bitflow`, `velar`
- `period`: `24h`, `7d`, `30d`, `1y`

---

### 6. NFT Floor
Show NFT collection floor price.

**Script Tag:**
```html
<script
  src="https://stkpulse.io/embed.js"
  data-widget="nft-floor"
  data-collection="SP2KAF9RF86PVX3NEE27DFV1CQX0T4WGR41X3S45C.bitcoin-monkeys"
  data-period="30d"
></script>
```

**Parameters:**
- `collection`: NFT collection contract (required)
- `period`: `24h`, `7d`, `30d`, `1y`

---

## Configuration Options

### Theme
- `light`: Light theme
- `dark`: Dark theme
- `auto`: Follows system preference

### Dimensions
- `width`: Number in pixels or `"auto"` (responsive)
- `height`: Number in pixels (default: 300)

### Styling
- `data-accent-color`: Hex color for chart line (default: `#5546ff`)
- `data-show-legend`: `true` or `false` (default: `true`)
- `data-show-grid`: `true` or `false` (default: `true`)

### Example with Custom Styling
```html
<script
  src="https://stkpulse.io/embed.js"
  data-widget="stx-price"
  data-theme="dark"
  data-period="30d"
  data-width="800"
  data-height="400"
  data-accent-color="#ff6b6b"
  data-show-legend="true"
  data-show-grid="true"
></script>
```

---

## Performance

- **Load Time**: < 1 second
- **Bundle Size**: ~15KB gzipped
- **Data Caching**: 30 seconds at CDN edge
- **No Cookies**: Privacy-friendly, no tracking
- **Responsive**: Adapts to container width

---

## Rate Limits

- **1000 requests/hour per IP** on widget API endpoints
- No authentication required
- Public endpoints

---

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

---

## Examples

### Embed in React
```jsx
export function MyComponent() {
  return (
    <div>
      <h2>STX Price</h2>
      <script
        src="https://stkpulse.io/embed.js"
        data-widget="stx-price"
        data-theme="dark"
        data-period="30d"
      />
    </div>
  );
}
```

### Embed in Vue
```vue
<template>
  <div>
    <h2>STX Price</h2>
    <script
      src="https://stkpulse.io/embed.js"
      data-widget="stx-price"
      data-theme="dark"
      data-period="30d"
    />
  </div>
</template>
```

### Embed in Plain HTML
```html
<!DOCTYPE html>
<html>
<head>
  <title>My Stacks dApp</title>
</head>
<body>
  <h1>Live STX Price</h1>
  <script
    src="https://stkpulse.io/embed.js"
    data-widget="stx-price"
    data-theme="dark"
    data-period="30d"
    data-width="600"
    data-height="300"
  ></script>
</body>
</html>
```

---

## Widget Builder

Use our no-code widget builder to generate embed code:

👉 [https://stkpulse.io/widget-builder](https://stkpulse.io/widget-builder)

---

## Support

- Documentation: https://docs.stkpulse.io
- GitHub: https://github.com/thewealthyplace/stkpulse
- Discord: https://discord.gg/stkpulse
