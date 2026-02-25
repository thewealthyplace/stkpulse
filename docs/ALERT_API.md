# Alert System API Documentation

## Overview
The Alert System provides real-time monitoring of on-chain events on the Stacks blockchain with configurable notifications via webhook, email, and in-app delivery.

## Base URL
```
https://api.stkpulse.com/api/v1
```

## Authentication
All endpoints require authentication via Bearer token (implementation pending).

## Alert Types

### 1. Token Transfer
Monitor STX or SIP-010 token transfers above a threshold.

```json
{
  "type": "token_transfer",
  "asset": "STX",
  "direction": "any",
  "amount_gte": 500000
}
```

### 2. Contract Call
Monitor specific contract function calls.

```json
{
  "type": "contract_call",
  "contract_id": "SP123.dao-contract",
  "function_name": "vote"
}
```

### 3. Wallet Activity
Monitor any activity from a watched address.

```json
{
  "type": "wallet_activity",
  "watched_address": "SP1ABC...XYZ"
}
```

### 4. Price Threshold
Monitor token price crossing a threshold.

```json
{
  "type": "price_threshold",
  "asset": "STX",
  "operator": "lt",
  "price_usd": 0.50
}
```

### 5. Stacking Cycle
Monitor stacking cycle start/end events.

```json
{
  "type": "stacking_cycle",
  "event": "start"
}
```

### 6. NFT Sale
Monitor NFT sales above a price threshold.

```json
{
  "type": "nft_sale",
  "collection_id": "SP123.nft-collection",
  "price_gte": 500
}
```

## Endpoints

### Create Alert
```http
POST /alerts
Content-Type: application/json

{
  "user_id": "user-123",
  "name": "Whale STX Transfer",
  "condition": {
    "type": "token_transfer",
    "asset": "STX",
    "direction": "any",
    "amount_gte": 500000
  },
  "notify": {
    "webhook": "https://hooks.example.com/stacks",
    "email": "user@example.com"
  },
  "cooldown_minutes": 60
}
```

**Response:**
```json
{
  "alert": {
    "id": "alrt_01HXYZ",
    "user_id": "user-123",
    "name": "Whale STX Transfer",
    "condition_type": "token_transfer",
    "condition_config": {...},
    "notify_webhook": "https://hooks.example.com/stacks",
    "notify_email": "user@example.com",
    "notify_in_app": true,
    "cooldown_minutes": 60,
    "is_active": true,
    "created_at": "2025-02-21T14:32:00Z",
    "updated_at": "2025-02-21T14:32:00Z"
  }
}
```

### Get All Alerts
```http
GET /alerts?user_id=user-123
```

### Get Single Alert
```http
GET /alerts/:id
```

### Update Alert
```http
PUT /alerts/:id
Content-Type: application/json

{
  "name": "Updated Alert Name",
  "cooldown_minutes": 120
}
```

### Delete Alert
```http
DELETE /alerts/:id
```

### Toggle Alert Status
```http
PATCH /alerts/:id/toggle
Content-Type: application/json

{
  "is_active": false
}
```

### Get Alert History
```http
GET /alerts/:id/history
```

**Response:**
```json
{
  "history": [
    {
      "id": 1,
      "alert_id": "alrt_01HXYZ",
      "triggered_at": "2025-02-21T14:32:00Z",
      "block_height": 212901,
      "tx_id": "0xabc123...",
      "event_data": {...},
      "webhook_status": "sent",
      "email_status": "sent",
      "in_app_read": false
    }
  ]
}
```

### SSE Stream (In-App Notifications)
```http
GET /alerts/stream?user_id=user-123
Accept: text/event-stream
```

**Event Stream:**
```
data: {"type":"connected","timestamp":1708531920000}

data: {"type":"alert","data":{"alert_id":"alrt_01HXYZ","alert_name":"Whale STX Transfer",...}}
```

## Webhook Payload

When an alert is triggered, the following payload is sent to the configured webhook URL:

```json
{
  "alert_id": "alrt_01HXYZ",
  "alert_name": "Whale STX Transfer",
  "triggered_at": "2025-02-21T14:32:00Z",
  "block_height": 212901,
  "tx_id": "0xabc123...",
  "event": {
    "type": "token_transfer",
    "asset": "STX",
    "amount": "750000000000",
    "sender": "SP1ABC...XYZ",
    "recipient": "SP2DEF...UVW"
  }
}
```

**Headers:**
- `Content-Type: application/json`
- `X-Alert-Id: alrt_01HXYZ`
- `X-Idempotency-Key: alrt_01HXYZ-0xabc123...`

## Delivery Guarantees

- **Webhooks**: Retried up to 3 times with exponential backoff (1s, 2s, 4s)
- **Emails**: Single delivery attempt
- **In-App**: Real-time via Server-Sent Events
- **At-least-once delivery** with idempotency keys
- **Alert history** stored for 90 days
- **Rate limiting**: Max 100 alerts per user per day

## Error Codes

- `400` - Invalid request body
- `404` - Alert not found
- `429` - Rate limit exceeded
- `500` - Internal server error
