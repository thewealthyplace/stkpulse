// Widget types and configuration

export type WidgetType =
  | "stx-price"
  | "contract-calls"
  | "stacking-cycle"
  | "token-price"
  | "tvl"
  | "nft-floor";

export type Theme = "light" | "dark" | "auto";
export type Period = "24h" | "7d" | "30d" | "1y";
export type Currency = "USD" | "BTC" | "STX";

export interface WidgetConfig {
  type: WidgetType;
  theme: Theme;
  period: Period;
  width: number | "auto";
  height: number;
  accentColor?: string;
  showLegend?: boolean;
  showGrid?: boolean;
  contract?: string;
  currency?: Currency;
  protocol?: string;
  collection?: string;
}

export interface WidgetData {
  type: WidgetType;
  data: any;
  timestamp: number;
  period: Period;
}
