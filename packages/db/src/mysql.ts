import * as mysql from 'mysql2/promise';

export class MySQLAdapter {
  private pool: mysql.Pool;

  constructor(config: mysql.PoolOptions) {
    this.pool = mysql.createPool(config);
  }

  async connect(): Promise<void> {
    // Pool handles connections automatically
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
  }

  // Basic query methods
  async query(sql: string, values?: any[]): Promise<any> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }
    const [rows] = await this.pool.execute(sql, values);
    return rows;
  }

  async find(table: string, conditions: any = {}, options: any = {}): Promise<any[]> {
    const whereClause = this.buildWhereClause(conditions);
    const limitClause = options.limit ? ` LIMIT ${options.limit}` : '';
    const offsetClause = options.offset ? ` OFFSET ${options.offset}` : '';
    const orderClause = options.order ? ` ORDER BY ${options.order}` : '';

    const sql = `SELECT * FROM ${table}${whereClause}${orderClause}${limitClause}${offsetClause}`;
    return this.query(sql);
  }

  async findOne(table: string, conditions: any = {}): Promise<any> {
    const results = await this.find(table, conditions, { limit: 1 });
    return results[0] || null;
  }

  async insert(table: string, data: any): Promise<any> {
    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data)
      .map(() => '?')
      .join(', ');
    const values = Object.values(data);

    const sql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`;
    return this.query(sql, values);
  }

  async update(table: string, data: any, conditions: any = {}): Promise<any> {
    const setClause = Object.keys(data)
      .map((key) => `${key} = ?`)
      .join(', ');
    const whereClause = this.buildWhereClause(conditions);
    const values = [...Object.values(data), ...Object.values(conditions)];

    const sql = `UPDATE ${table} SET ${setClause}${whereClause}`;
    return this.query(sql, values);
  }

  async delete(table: string, conditions: any = {}): Promise<any> {
    const whereClause = this.buildWhereClause(conditions);
    const values = Object.values(conditions);

    const sql = `DELETE FROM ${table}${whereClause}`;
    return this.query(sql, values);
  }

  private buildWhereClause(conditions: any): string {
    if (Object.keys(conditions).length === 0) return '';
    const clauses = Object.keys(conditions).map((key) => `${key} = ?`);
    return ` WHERE ${clauses.join(' AND ')}`;
  }
}
