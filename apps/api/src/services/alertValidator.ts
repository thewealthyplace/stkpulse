// Alert validation service - validates alert configurations against JSON schema

import { AlertCondition } from "@stkpulse/shared/alert-types";

export class AlertValidator {
  validateCondition(condition: AlertCondition): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    switch (condition.type) {
      case "token_transfer":
        if (!condition.asset) errors.push("asset is required");
        if (!["sent", "received", "any"].includes(condition.direction)) {
          errors.push("direction must be sent, received, or any");
        }
        if (condition.amount_gte !== undefined && condition.amount_gte <= 0) {
          errors.push("amount_gte must be positive");
        }
        break;

      case "contract_call":
        if (!condition.contract_id) errors.push("contract_id is required");
        if (!condition.function_name) errors.push("function_name is required");
        break;

      case "wallet_activity":
        if (!condition.watched_address) errors.push("watched_address is required");
        if (!this.isValidStacksAddress(condition.watched_address)) {
          errors.push("watched_address must be a valid Stacks address");
        }
        break;

      case "price_threshold":
        if (!condition.asset) errors.push("asset is required");
        if (!["gt", "lt", "gte", "lte"].includes(condition.operator)) {
          errors.push("operator must be gt, lt, gte, or lte");
        }
        if (condition.price_usd === undefined || condition.price_usd <= 0) {
          errors.push("price_usd must be positive");
        }
        break;

      case "stacking_cycle":
        if (!["start", "end"].includes(condition.event)) {
          errors.push("event must be start or end");
        }
        break;

      case "nft_sale":
        if (condition.price_gte !== undefined && condition.price_gte <= 0) {
          errors.push("price_gte must be positive");
        }
        break;

      default:
        errors.push("invalid condition type");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  validateNotification(notify: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!notify.webhook && !notify.email) {
      errors.push("at least one notification method (webhook or email) is required");
    }

    if (notify.webhook && !this.isValidUrl(notify.webhook)) {
      errors.push("webhook must be a valid HTTPS URL");
    }

    if (notify.email && !this.isValidEmail(notify.email)) {
      errors.push("email must be a valid email address");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private isValidStacksAddress(address: string): boolean {
    return /^SP[0-9A-Z]{38,41}$|^SM[0-9A-Z]{38,41}$/.test(address);
  }

  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
