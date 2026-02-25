// Alert condition types and validation schemas

export type AlertConditionType =
  | "token_transfer"
  | "contract_call"
  | "wallet_activity"
  | "price_threshold"
  | "stacking_cycle"
  | "nft_sale";

export interface TokenTransferCondition {
  type: "token_transfer";
  asset: string;
  direction: "sent" | "received" | "any";
  amount_gte?: number;
  from_address?: string;
  to_address?: string;
}

export interface ContractCallCondition {
  type: "contract_call";
  contract_id: string;
  function_name: string;
  caller_address?: string;
}

export interface WalletActivityCondition {
  type: "wallet_activity";
  watched_address: string;
}

export interface PriceThresholdCondition {
  type: "price_threshold";
  asset: string;
  operator: "gt" | "lt" | "gte" | "lte";
  price_usd: number;
}

export interface StackingCycleCondition {
  type: "stacking_cycle";
  event: "start" | "end";
}

export interface NftSaleCondition {
  type: "nft_sale";
  collection_id?: string;
  price_gte?: number;
}

export type AlertCondition =
  | TokenTransferCondition
  | ContractCallCondition
  | WalletActivityCondition
  | PriceThresholdCondition
  | StackingCycleCondition
  | NftSaleCondition;

export interface AlertNotification {
  webhook?: string;
  email?: string;
}

export interface CreateAlertRequest {
  name: string;
  condition: AlertCondition;
  notify: AlertNotification;
  cooldown_minutes?: number;
}

export interface Alert {
  id: string;
  user_id: string;
  name: string;
  condition_type: AlertConditionType;
  condition_config: AlertCondition;
  notify_webhook?: string;
  notify_email?: string;
  notify_in_app: boolean;
  cooldown_minutes: number;
  last_triggered_at?: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface AlertEvent {
  alert_id: string;
  alert_name: string;
  triggered_at: string;
  block_height?: number;
  tx_id?: string;
  event: Record<string, any>;
}
