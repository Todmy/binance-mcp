import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { Alert, AlertResult } from '../types/alerts';

export class SQLiteStorage {
  private db?: Database;
  private readonly dbPath: string;

  constructor(dbPath: string = ':memory:') {
    this.dbPath = dbPath;
  }

  public async initialize(): Promise<void> {
    this.db = await open({
      filename: this.dbPath,
      driver: sqlite3.Database
    });

    await this.createTables();
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        symbol TEXT NOT NULL,
        type TEXT NOT NULL,
        conditions TEXT NOT NULL,
        order_config TEXT,
        is_enabled INTEGER NOT NULL,
        description TEXT,
        created_at INTEGER NOT NULL,
        last_triggered INTEGER,
        trigger_count INTEGER NOT NULL DEFAULT 0,
        last_check INTEGER
      )
    `);

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS alert_results (
        id TEXT PRIMARY KEY,
        alert_id TEXT NOT NULL,
        triggered INTEGER NOT NULL,
        values TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (alert_id) REFERENCES alerts (id)
      )
    `);

    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_alerts_symbol ON alerts(symbol);
      CREATE INDEX IF NOT EXISTS idx_alert_results_timestamp ON alert_results(timestamp);
    `);
  }

  public async saveAlert(alert: Alert): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.run(
      `INSERT OR REPLACE INTO alerts (
        id, symbol, type, conditions, order_config, is_enabled, description,
        created_at, last_triggered, trigger_count, last_check
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        alert.id,
        alert.symbol,
        alert.type,
        JSON.stringify(alert.conditions),
        alert.order ? JSON.stringify(alert.order) : null,
        alert.isEnabled ? 1 : 0,
        alert.description,
        alert.createdAt,
        alert.lastTriggered || null,
        alert.triggerCount,
        Date.now()
      ]
    );
  }

  public async getAlerts(): Promise<Alert[]> {
    if (!this.db) throw new Error('Database not initialized');

    const rows = await this.db.all(`
      SELECT id, symbol, type, conditions, order_config, is_enabled,
             description, created_at, last_triggered, trigger_count
      FROM alerts
    `) as Array<{
      id: string;
      symbol: string;
      type: string;
      conditions: string;
      order_config: string | null;
      is_enabled: number;
      description: string | null;
      created_at: number;
      last_triggered: number | null;
      trigger_count: number;
    }>;

    return rows.map((row): Alert => ({
      id: row.id,
      symbol: row.symbol,
      type: row.type as Alert['type'],
      conditions: JSON.parse(row.conditions),
      order: row.order_config ? JSON.parse(row.order_config) : undefined,
      isEnabled: Boolean(row.is_enabled),
      description: row.description || undefined,
      createdAt: row.created_at,
      lastTriggered: row.last_triggered || undefined,
      triggerCount: row.trigger_count
    }));
  }

  public async deleteAlert(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.run('DELETE FROM alerts WHERE id = ?', id);
    await this.db.run('DELETE FROM alert_results WHERE alert_id = ?', id);
  }

  public async saveAlertResult(result: AlertResult): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.run(
      `INSERT INTO alert_results (
        id, alert_id, triggered, values, timestamp
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        `${result.alert.id}_${result.timestamp}`,
        result.alert.id,
        result.triggered ? 1 : 0,
        JSON.stringify(result.values),
        result.timestamp
      ]
    );
  }

  public async getTriggeredAlerts(since?: number): Promise<AlertResult[]> {
    if (!this.db) throw new Error('Database not initialized');

    const query = since
      ? `SELECT ar.*, a.*
         FROM alert_results ar
         JOIN alerts a ON ar.alert_id = a.id
         WHERE ar.triggered = 1 AND ar.timestamp > ?
         ORDER BY ar.timestamp DESC`
      : `SELECT ar.*, a.*
         FROM alert_results ar
         JOIN alerts a ON ar.alert_id = a.id
         WHERE ar.triggered = 1
         ORDER BY ar.timestamp DESC`;

    const params = since ? [since] : [];
    const rows = await this.db.all(query, params) as Array<{
      id: string;
      alert_id: string;
      triggered: number;
      values: string;
      timestamp: number;
      type: string;
      symbol: string;
      conditions: string;
      order_config: string | null;
      is_enabled: number;
      description: string | null;
      created_at: number;
      last_triggered: number | null;
      trigger_count: number;
    }>;

    return rows.map(row => ({
      alert: {
        id: row.alert_id,
        symbol: row.symbol,
        type: row.type as Alert['type'],
        conditions: JSON.parse(row.conditions),
        order: row.order_config ? JSON.parse(row.order_config) : undefined,
        isEnabled: Boolean(row.is_enabled),
        description: row.description || undefined,
        createdAt: row.created_at,
        lastTriggered: row.last_triggered || undefined,
        triggerCount: row.trigger_count
      },
      triggered: Boolean(row.triggered),
      values: JSON.parse(row.values),
      timestamp: row.timestamp
    }));
  }

  public async cleanup(): Promise<void> {
    if (this.db) {
      await this.db.close();
    }
  }
}
