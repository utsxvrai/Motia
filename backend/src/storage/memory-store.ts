import { User, UserStatus } from '../types/user';
import { WorkflowExecution } from '../types/workflow';

/**
 * @deprecated Use DatabaseService instead for production
 * This is kept for backwards compatibility during migration
 */
export class MemoryStore {
  private users: Map<string, User> = new Map();
  private workflows: Map<string, WorkflowExecution> = new Map();
  private verificationTokens: Map<string, string> = new Map(); // token -> userId
  private userWorkflows: Map<string, string> = new Map(); // userId -> workflowId

  // User operations
  createUser(user: User): void {
    this.users.set(user.id, user);
  }

  setUserWorkflow(userId: string, workflowId: string): void {
    this.userWorkflows.set(userId, workflowId);
  }

  getWorkflowByUserId(userId: string): string | undefined {
    return this.userWorkflows.get(userId);
  }

  getUser(userId: string): User | undefined {
    return this.users.get(userId);
  }

  updateUser(userId: string, updates: Partial<User>): void {
    const user = this.users.get(userId);
    if (user) {
      this.users.set(userId, { ...user, ...updates });
    }
  }

  getAllUsers(): User[] {
    return Array.from(this.users.values());
  }

  // Workflow operations
  saveWorkflow(workflow: WorkflowExecution): void {
    this.workflows.set(workflow.id, workflow);
  }

  getWorkflow(workflowId: string): WorkflowExecution | undefined {
    return this.workflows.get(workflowId);
  }

  getAllWorkflows(): WorkflowExecution[] {
    return Array.from(this.workflows.values());
  }

  // Verification token operations
  setVerificationToken(token: string, userId: string): void {
    this.verificationTokens.set(token, userId);
  }

  getUserIdByToken(token: string): string | undefined {
    return this.verificationTokens.get(token);
  }

  deleteVerificationToken(token: string): void {
    this.verificationTokens.delete(token);
  }
}

export const store = new MemoryStore();

