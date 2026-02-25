// Email delivery service for alert notifications

import { Pool } from "pg";
import { AlertEvent } from "@stkpulse/shared/alert-types";
import nodemailer from "nodemailer";

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private db: Pool) {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendAlertEmail(alertEvent: AlertEvent, recipientEmail: string) {
    const subject = `Alert: ${alertEvent.alert_name}`;
    const html = this.buildEmailHtml(alertEvent);

    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || "alerts@stkpulse.com",
        to: recipientEmail,
        subject,
        html,
      });

      await this.markEmailSent(alertEvent.alert_id);
      return { success: true };
    } catch (error: any) {
      await this.markEmailFailed(alertEvent.alert_id, error.message);
      return { success: false, error: error.message };
    }
  }

  private buildEmailHtml(event: AlertEvent): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #5546ff; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
          .footer { text-align: center; padding: 10px; color: #666; font-size: 12px; }
          .event-data { background: white; padding: 15px; border-radius: 5px; margin-top: 10px; }
          code { background: #eee; padding: 2px 5px; border-radius: 3px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>🔔 ${event.alert_name}</h2>
          </div>
          <div class="content">
            <p><strong>Triggered at:</strong> ${new Date(event.triggered_at).toLocaleString()}</p>
            <p><strong>Block Height:</strong> ${event.block_height}</p>
            <p><strong>Transaction ID:</strong> <code>${event.tx_id}</code></p>
            <div class="event-data">
              <h3>Event Details</h3>
              <pre>${JSON.stringify(event.event, null, 2)}</pre>
            </div>
          </div>
          <div class="footer">
            <p>StkPulse Alert System | <a href="https://stkpulse.com">Manage Alerts</a></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private async markEmailSent(alertId: string) {
    await this.db.query(
      `UPDATE alert_history SET email_status = 'sent' 
       WHERE alert_id = $1 AND email_status = 'pending'`,
      [alertId]
    );
  }

  private async markEmailFailed(alertId: string, error: string) {
    await this.db.query(
      `UPDATE alert_history SET email_status = 'failed' 
       WHERE alert_id = $1 AND email_status = 'pending'`,
      [alertId]
    );
  }
}
