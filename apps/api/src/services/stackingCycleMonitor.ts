// Stacking cycle monitor for cycle start/end alerts

import { Pool } from "pg";
import { EventEmitter } from "events";
import fetch from "node-fetch";

export interface StackingCycleEvent {
  cycle_number: number;
  event_type: "start" | "end";
  block_height: number;
}

export class StackingCycleMonitor extends EventEmitter {
  private currentCycle: number | null = null;
  private monitorInterval: NodeJS.Timeout | null = null;

  constructor(
    private db: Pool,
    private stacksApiUrl: string = "https://api.hiro.so",
    private intervalMs: number = 300000 // 5 minutes
  ) {
    super();
  }

  start() {
    this.monitorInterval = setInterval(() => {
      this.checkCycle();
    }, this.intervalMs);

    // Initial check
    this.checkCycle();
  }

  stop() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }

  private async checkCycle() {
    try {
      const response = await fetch(`${this.stacksApiUrl}/extended/v1/pox/cycles/current`);
      const data: any = await response.json();

      const cycleNumber = data.cycle_number;

      if (this.currentCycle === null) {
        this.currentCycle = cycleNumber;
        return;
      }

      if (cycleNumber > this.currentCycle) {
        // Cycle ended and new one started
        this.emit("cycle_end", {
          cycle_number: this.currentCycle,
          event_type: "end",
          block_height: data.block_height,
        } as StackingCycleEvent);

        this.emit("cycle_start", {
          cycle_number: cycleNumber,
          event_type: "start",
          block_height: data.block_height,
        } as StackingCycleEvent);

        this.currentCycle = cycleNumber;
      }
    } catch (err) {
      console.error("[StackingCycleMonitor] Error:", err);
    }
  }

  async evaluateStackingAlerts(event: StackingCycleEvent) {
    const { rows } = await this.db.query(
      `SELECT * FROM alerts 
       WHERE condition_type = 'stacking_cycle' 
       AND is_active = true`
    );

    const triggeredAlerts = [];

    for (const alert of rows) {
      const condition = alert.condition_config;

      if (condition.event === event.event_type) {
        triggeredAlerts.push({
          alert_id: alert.id,
          alert_name: alert.name,
          triggered_at: new Date().toISOString(),
          block_height: event.block_height,
          event: {
            type: "stacking_cycle",
            cycle_number: event.cycle_number,
            event_type: event.event_type,
          },
        });
      }
    }

    return triggeredAlerts;
  }
}
