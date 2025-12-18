import { StepDefinition, StepContext, StepResult, WorkflowDefinition, WorkflowExecution, StepExecution, LogEntry } from '../types/workflow';
import { database } from '../storage/database';

// Motia runtime - simulates the core Motia framework
export class MotiaRuntime {
  private stepDefinitions: Map<string, StepDefinition> = new Map();
  private workflowDefinitions: Map<string, WorkflowDefinition> = new Map();

  registerStep(step: StepDefinition): void {
    this.stepDefinitions.set(step.id, step);
  }

  registerWorkflow(workflow: WorkflowDefinition): void {
    this.workflowDefinitions.set(workflow.id, workflow);
  }

  async startWorkflow(workflowId: string, initialInput: any): Promise<WorkflowExecution> {
    const workflowDef = this.workflowDefinitions.get(workflowId);
    if (!workflowDef) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const execution: WorkflowExecution = {
      id: uuidv4(),
      workflowId,
      status: 'running',
      startedAt: new Date(),
      steps: workflowDef.steps.map(step => ({
        stepId: step.id,
        status: 'pending',
        attempts: 0,
        logs: [],
      })),
    };

    database.saveWorkflow(execution);
    
    // Start execution asynchronously
    this.executeWorkflow(execution, initialInput).catch(err => {
      const errorMessage = (err as Error).message;
      // Don't mark as failed if it's just waiting for a signal
      if (!errorMessage.includes('WORKFLOW_PAUSED_WAITING_FOR_SIGNAL')) {
        console.error(`Workflow ${execution.id} failed:`, err);
        execution.status = 'failed';
        database.saveWorkflow(execution);
      }
    });

    return execution;
  }

  async executeWorkflow(execution: WorkflowExecution, initialInput: any): Promise<void> {
    const workflowDef = this.workflowDefinitions.get(execution.workflowId);
    if (!workflowDef) return;

    let currentInput = initialInput;
    execution.currentStep = undefined;

    for (const stepDef of workflowDef.steps) {
      const stepExecution = execution.steps.find(s => s.stepId === stepDef.id);
      if (!stepExecution) continue;

      // Skip if already completed (for idempotency)
      if (stepExecution.status === 'completed') {
        currentInput = stepExecution.output;
        continue;
      }

      execution.currentStep = stepDef.id;
      database.saveWorkflow(execution);

      // Execute step with retry logic
      try {
        const result = await this.executeStepWithRetry(
          stepDef,
          stepExecution,
          execution.id,
          currentInput
        );

        if (stepExecution.status === 'failed') {
          execution.status = 'failed';
          database.saveWorkflow(execution);
          return;
        }

        // Check if step is waiting for a signal
        if (stepExecution.status === 'running' && stepExecution.logs.some(
          log => log.message.includes('WORKFLOW_PAUSED_WAITING_FOR_SIGNAL')
        )) {
          // Workflow is paused, waiting for signal
          execution.status = 'paused';
          database.saveWorkflow(execution);
          return;
        }

        currentInput = result.output;
      } catch (error) {
        const errorMessage = (error as Error).message;
        if (errorMessage.includes('WORKFLOW_PAUSED_WAITING_FOR_SIGNAL')) {
          // This is expected for wait steps
          execution.status = 'paused';
          database.saveWorkflow(execution);
          return;
        }
        throw error;
      }
    }

    execution.status = 'completed';
    execution.completedAt = new Date();
    execution.currentStep = undefined;
    database.saveWorkflow(execution);
  }

  private async executeStepWithRetry(
    stepDef: StepDefinition,
    stepExecution: StepExecution,
    workflowId: string,
    input: any
  ): Promise<StepResult> {
    const maxAttempts = stepDef.retryPolicy?.maxAttempts ?? 3;
    const backoffMs = stepDef.retryPolicy?.backoffMs ?? 1000;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      stepExecution.attempts = attempt;
      stepExecution.status = attempt === 1 ? 'running' : 'retrying';
      stepExecution.startedAt = new Date();

      this.logStep(stepExecution, `Attempt ${attempt}/${maxAttempts}`);

      try {
        const context: StepContext = {
          input,
          stepId: stepDef.id,
          workflowId,
          attempt,
          log: (message, data) => this.logStep(stepExecution, message, data),
          getState: (key) => this.getWorkflowState(workflowId, key),
          setState: (key, value) => this.setWorkflowState(workflowId, key, value),
        };

        const result = await stepDef.handler(context);
        
        stepExecution.status = 'completed';
        stepExecution.completedAt = new Date();
        stepExecution.output = result.output;
        this.logStep(stepExecution, `Step completed successfully`);

        return result;
      } catch (error) {
        lastError = error as Error;
        const errorMessage = lastError.message;

        // Check if this is a workflow pause signal (for durable waits)
        if (errorMessage.includes('WORKFLOW_PAUSED_WAITING_FOR_SIGNAL')) {
          stepExecution.status = 'running'; // Keep it running, just paused
          stepExecution.error = undefined;
          this.logStep(stepExecution, 'Workflow paused, waiting for signal');
          throw lastError; // Re-throw to pause workflow
        }

        stepExecution.error = errorMessage;
        this.logStep(stepExecution, `Attempt ${attempt} failed: ${errorMessage}`);

        if (attempt < maxAttempts) {
          await this.sleep(backoffMs * attempt); // Exponential backoff
        }
      }
    }

    stepExecution.status = 'failed';
    stepExecution.completedAt = new Date();
    throw lastError || new Error('Step failed after all retries');
  }

  private logStep(stepExecution: StepExecution, message: string, data?: any): void {
    const logEntry: LogEntry = {
      timestamp: new Date(),
      message,
      data,
    };
    stepExecution.logs.push(logEntry);
    console.log(`[${stepExecution.stepId}] ${message}`, data || '');
  }

  private workflowState: Map<string, Map<string, any>> = new Map();

  private getWorkflowState(workflowId: string, key: string): any {
    const state = this.workflowState.get(workflowId);
    return state?.get(key);
  }

  private setWorkflowState(workflowId: string, key: string, value: any): void {
    if (!this.workflowState.has(workflowId)) {
      this.workflowState.set(workflowId, new Map());
    }
    this.workflowState.get(workflowId)!.set(key, value);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getWorkflow(workflowId: string): WorkflowExecution | undefined {
    return database.getWorkflow(workflowId);
  }

  // Signal method for durable waits
  async signalWorkflow(workflowId: string, event: string, data: any): Promise<void> {
    const execution = database.getWorkflow(workflowId);
    if (!execution || (execution.status !== 'running' && execution.status !== 'paused')) {
      return;
    }

    // Store the signal data in workflow state
    if (!this.workflowState.has(workflowId)) {
      this.workflowState.set(workflowId, new Map());
    }
    this.workflowState.get(workflowId)!.set(`signal:${event}`, {
      ...data,
      timestamp: new Date(),
    });

    // Resume workflow execution
    execution.status = 'running';
    const workflowDef = this.workflowDefinitions.get(execution.workflowId);
    if (workflowDef && execution.currentStep) {
      // Find the last completed step to get its output
      const currentStepIndex = workflowDef.steps.findIndex(s => s.id === execution.currentStep);
      const lastCompletedIndex = currentStepIndex > 0 ? currentStepIndex - 1 : -1;
      const lastCompletedStep = lastCompletedIndex >= 0 
        ? execution.steps[lastCompletedIndex]
        : null;
      
      const resumeInput = lastCompletedStep?.output || {};
      
      // Re-execute the waiting step now that we have the signal
      // Reset the waiting step status so it can re-execute and find the signal
      const waitingStep = execution.steps.find(s => s.stepId === execution.currentStep);
      if (waitingStep) {
        waitingStep.status = 'pending';
        waitingStep.error = undefined;
      }

      // Continue workflow execution - the wait step will now find the signal and complete
      await this.executeWorkflow(execution, resumeInput);
    }
  }
}

// Simple UUID generator
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const motia = new MotiaRuntime();

