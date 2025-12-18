import Database from 'better-sqlite3';
import { User, UserStatus } from '../types/user';
import { WorkflowExecution } from '../types/workflow';

/**
 * Production-ready Database Service
 * Uses SQLite for simplicity (file-based, no server required)
 * Can be easily migrated to PostgreSQL/MySQL for production scale
 */
export class DatabaseService {
  private db: Database.Database;
  private dbPath: string;

  constructor() {
    this.dbPath = process.env.DATABASE_PATH || './motia-database.db';
    this.db = new Database(this.dbPath);
    
    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
    
    this.initializeTables();
    console.log(`✅ Database initialized: ${this.dbPath}`);
  }

  private initializeTables(): void {
    // Users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        verified_at TEXT,
        risk_decision TEXT,
        risk_check_at TEXT,
        risk_score REAL,
        risk_reasoning TEXT,
        risk_confidence REAL
      )
    `);

    // Workflows table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        status TEXT NOT NULL,
        current_step TEXT,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        steps_data TEXT NOT NULL
      )
    `);

    // User-Workflow mapping
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_workflows (
        user_id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        FOREIGN KEY (workflow_id) REFERENCES workflows(id)
      )
    `);

    // Verification tokens table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS verification_tokens (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Create indexes for performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
      CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
      CREATE INDEX IF NOT EXISTS idx_tokens_user_id ON verification_tokens(user_id);
    `);
  }

  // User operations
  createUser(user: User): void {
    const stmt = this.db.prepare(`
      INSERT INTO users (id, email, name, status, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(
      user.id,
      user.email,
      user.name,
      user.status,
      user.createdAt.toISOString()
    );
  }

  getUser(userId: string): User | undefined {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    const row = stmt.get(userId) as any;
    if (!row) return undefined;

    return this.mapRowToUser(row);
  }

  getUserByEmail(email: string): User | undefined {
    const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
    const row = stmt.get(email) as any;
    if (!row) return undefined;

    return this.mapRowToUser(row);
  }

  updateUser(userId: string, updates: Partial<User>): void {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.status) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.verifiedAt) {
      fields.push('verified_at = ?');
      values.push(updates.verifiedAt.toISOString());
    }
    if (updates.riskDecision) {
      fields.push('risk_decision = ?');
      values.push(updates.riskDecision);
    }
    if (updates.riskCheckAt) {
      fields.push('risk_check_at = ?');
      values.push(updates.riskCheckAt.toISOString());
    }
    if (updates.riskScore !== undefined) {
      fields.push('risk_score = ?');
      values.push(updates.riskScore);
    }
    if (updates.riskReasoning) {
      fields.push('risk_reasoning = ?');
      values.push(updates.riskReasoning);
    }
    if (updates.riskConfidence !== undefined) {
      fields.push('risk_confidence = ?');
      values.push(updates.riskConfidence);
    }

    if (fields.length === 0) return;

    values.push(userId);
    const stmt = this.db.prepare(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`
    );
    stmt.run(...values);
  }

  getAllUsers(): User[] {
    const stmt = this.db.prepare('SELECT * FROM users ORDER BY created_at DESC');
    const rows = stmt.all() as any[];
    return rows.map(row => this.mapRowToUser(row));
  }

  private mapRowToUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      status: row.status as UserStatus,
      createdAt: new Date(row.created_at),
      verifiedAt: row.verified_at ? new Date(row.verified_at) : undefined,
      riskDecision: row.risk_decision as any,
      riskCheckAt: row.risk_check_at ? new Date(row.risk_check_at) : undefined,
      riskScore: row.risk_score,
      riskReasoning: row.risk_reasoning,
      riskConfidence: row.risk_confidence,
    };
  }

  // Workflow operations
  saveWorkflow(workflow: WorkflowExecution): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO workflows 
      (id, workflow_id, status, current_step, started_at, completed_at, steps_data)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      workflow.id,
      workflow.workflowId,
      workflow.status,
      workflow.currentStep || null,
      workflow.startedAt.toISOString(),
      workflow.completedAt?.toISOString() || null,
      JSON.stringify(workflow.steps)
    );
  }

  getWorkflow(workflowId: string): WorkflowExecution | undefined {
    const stmt = this.db.prepare('SELECT * FROM workflows WHERE id = ?');
    const row = stmt.get(workflowId) as any;
    if (!row) return undefined;

    return {
      id: row.id,
      workflowId: row.workflow_id,
      status: row.status as any,
      currentStep: row.current_step || undefined,
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      steps: JSON.parse(row.steps_data),
    };
  }

  getAllWorkflows(): WorkflowExecution[] {
    const stmt = this.db.prepare('SELECT * FROM workflows ORDER BY started_at DESC');
    const rows = stmt.all() as any[];
    return rows.map(row => ({
      id: row.id,
      workflowId: row.workflow_id,
      status: row.status as any,
      currentStep: row.current_step || undefined,
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      steps: JSON.parse(row.steps_data),
    }));
  }

  setUserWorkflow(userId: string, workflowId: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO user_workflows (user_id, workflow_id)
      VALUES (?, ?)
    `);
    stmt.run(userId, workflowId);
  }

  getWorkflowByUserId(userId: string): string | undefined {
    const stmt = this.db.prepare('SELECT workflow_id FROM user_workflows WHERE user_id = ?');
    const row = stmt.get(userId) as any;
    return row?.workflow_id;
  }

  // Verification token operations
  setVerificationToken(token: string, userId: string, expiresInHours: number = 24): void {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInHours * 60 * 60 * 1000);

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO verification_tokens (token, user_id, created_at, expires_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(token, userId, now.toISOString(), expiresAt.toISOString());
  }

  getUserIdByToken(token: string): string | undefined {
    const stmt = this.db.prepare(`
      SELECT user_id FROM verification_tokens 
      WHERE token = ? AND expires_at > datetime('now')
    `);
    const row = stmt.get(token) as any;
    return row?.user_id;
  }

  deleteVerificationToken(token: string): void {
    const stmt = this.db.prepare('DELETE FROM verification_tokens WHERE token = ?');
    stmt.run(token);
  }

  // Cleanup expired tokens
  cleanupExpiredTokens(): void {
    const stmt = this.db.prepare("DELETE FROM verification_tokens WHERE expires_at < datetime('now')");
    stmt.run();
  }

  close(): void {
    this.db.close();
  }
}

// Singleton instance
export const database = new DatabaseService();

