// Alert CRUD API routes

import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { Pool } from "pg";
import { CreateAlertRequest, Alert } from "@stkpulse/shared/alert-types";

export async function alertRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions & { db: Pool; sseService: any }
) {
  const { db, sseService } = options;

  // Create alert
  fastify.post<{ Body: CreateAlertRequest & { user_id: string } }>(
    "/alerts",
    async (request, reply) => {
      const { user_id, name, condition, notify, cooldown_minutes } = request.body;

      const { rows } = await db.query<Alert>(
        `INSERT INTO alerts (user_id, name, condition_type, condition_config, notify_webhook, notify_email, cooldown_minutes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          user_id,
          name,
          condition.type,
          JSON.stringify(condition),
          notify.webhook || null,
          notify.email || null,
          cooldown_minutes || 0,
        ]
      );

      return { alert: rows[0] };
    }
  );

  // Get all alerts for user
  fastify.get<{ Querystring: { user_id: string } }>("/alerts", async (request, reply) => {
    const { user_id } = request.query;

    const { rows } = await db.query<Alert>(
      `SELECT * FROM alerts WHERE user_id = $1 ORDER BY created_at DESC`,
      [user_id]
    );

    return { alerts: rows };
  });

  // Get single alert
  fastify.get<{ Params: { id: string } }>("/alerts/:id", async (request, reply) => {
    const { id } = request.params;

    const { rows } = await db.query<Alert>(`SELECT * FROM alerts WHERE id = $1`, [id]);

    if (rows.length === 0) {
      return reply.status(404).send({ error: "Alert not found" });
    }

    return { alert: rows[0] };
  });

  // Update alert
  fastify.put<{ Params: { id: string }; Body: Partial<CreateAlertRequest> }>(
    "/alerts/:id",
    async (request, reply) => {
      const { id } = request.params;
      const { name, condition, notify, cooldown_minutes } = request.body;

      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (name) {
        updates.push(`name = $${paramIndex++}`);
        values.push(name);
      }
      if (condition) {
        updates.push(`condition_type = $${paramIndex++}, condition_config = $${paramIndex++}`);
        values.push(condition.type, JSON.stringify(condition));
      }
      if (notify) {
        if (notify.webhook !== undefined) {
          updates.push(`notify_webhook = $${paramIndex++}`);
          values.push(notify.webhook);
        }
        if (notify.email !== undefined) {
          updates.push(`notify_email = $${paramIndex++}`);
          values.push(notify.email);
        }
      }
      if (cooldown_minutes !== undefined) {
        updates.push(`cooldown_minutes = $${paramIndex++}`);
        values.push(cooldown_minutes);
      }

      updates.push(`updated_at = NOW()`);
      values.push(id);

      const { rows } = await db.query<Alert>(
        `UPDATE alerts SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
        values
      );

      if (rows.length === 0) {
        return reply.status(404).send({ error: "Alert not found" });
      }

      return { alert: rows[0] };
    }
  );

  // Delete alert
  fastify.delete<{ Params: { id: string } }>("/alerts/:id", async (request, reply) => {
    const { id } = request.params;

    const { rowCount } = await db.query(`DELETE FROM alerts WHERE id = $1`, [id]);

    if (rowCount === 0) {
      return reply.status(404).send({ error: "Alert not found" });
    }

    return { success: true };
  });

  // Toggle alert active status
  fastify.patch<{ Params: { id: string }; Body: { is_active: boolean } }>(
    "/alerts/:id/toggle",
    async (request, reply) => {
      const { id } = request.params;
      const { is_active } = request.body;

      const { rows } = await db.query<Alert>(
        `UPDATE alerts SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [is_active, id]
      );

      if (rows.length === 0) {
        return reply.status(404).send({ error: "Alert not found" });
      }

      return { alert: rows[0] };
    }
  );

  // Get alert history
  fastify.get<{ Params: { id: string } }>("/alerts/:id/history", async (request, reply) => {
    const { id } = request.params;

    const { rows } = await db.query(
      `SELECT * FROM alert_history 
       WHERE alert_id = $1 
       ORDER BY triggered_at DESC 
       LIMIT 100`,
      [id]
    );

    return { history: rows };
  });

  // SSE endpoint for in-app notifications
  fastify.get<{ Querystring: { user_id: string } }>(
    "/alerts/stream",
    async (request, reply) => {
      const { user_id } = request.query;
      sseService.registerClient(user_id, reply);
    }
  );
}
