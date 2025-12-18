export interface StepContext<TInput = any, TOutput = any> {
  input: TInput;
  stepId: string;
  workflowId: string;
  attempt: number;
  log(message: string, data?: any): void;
  getState(key: string): any;
  setState(key: string, value: any): void;
}

export interface StepResult<TOutput = any> {
  output: TOutput;
  next?: string; // Next step ID, or undefined to continue sequentially
}

export type StepHandler<TInput = any, TOutput = any> = (
  context: StepContext<TInput, TOutput>
) => Promise<StepResult<TOutput>>;

export interface StepDefinition {
  id: string;
  name: string;
  handler: StepHandler;
  retryPolicy?: {
    maxAttempts?: number;
    backoffMs?: number;
  };
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  steps: StepDefinition[];
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  currentStep?: string;
  startedAt: Date;
  completedAt?: Date;
  steps: StepExecution[];
}

export interface StepExecution {
  stepId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'retrying';
  attempts: number;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  output?: any;
  logs: LogEntry[];
}

export interface LogEntry {
  timestamp: Date;
  message: string;
  data?: any;
}

