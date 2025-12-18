import { Request, Response } from 'express';
import { database } from '../storage/database';

interface WorkflowMetrics {
  totalWorkflows: number;
  completed: number;
  failed: number;
  running: number;
  paused: number;
  averageExecutionTime: number;
  stepSuccessRate: Record<string, { total: number; successful: number; failed: number }>;
}

interface UserMetrics {
  totalUsers: number;
  active: number;
  flagged: number;
  pending: number;
  riskDistribution: {
    allowed: number;
    flagged: number;
  };
}

export async function getMetricsHandler(_req: Request, res: Response) {
  try {
    const workflows = database.getAllWorkflows();
    const users = database.getAllUsers();

    // Calculate workflow metrics
    const workflowMetrics: WorkflowMetrics = {
      totalWorkflows: workflows.length,
      completed: workflows.filter(w => w.status === 'completed').length,
      failed: workflows.filter(w => w.status === 'failed').length,
      running: workflows.filter(w => w.status === 'running').length,
      paused: workflows.filter(w => w.status === 'paused').length,
      averageExecutionTime: calculateAverageExecutionTime(workflows),
      stepSuccessRate: calculateStepSuccessRate(workflows),
    };

    // Calculate user metrics
    const userMetrics: UserMetrics = {
      totalUsers: users.length,
      active: users.filter(u => u.status === 'ACTIVE').length,
      flagged: users.filter(u => u.status === 'FLAGGED').length,
      pending: users.filter(u => u.status === 'PENDING').length,
      riskDistribution: {
        allowed: users.filter(u => u.riskDecision === 'ALLOW').length,
        flagged: users.filter(u => u.riskDecision === 'FLAG').length,
      },
    };

    res.json({
      workflows: workflowMetrics,
      users: userMetrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Metrics error:', error);
    res.status(500).json({
      error: 'Failed to get metrics',
      message: (error as Error).message,
    });
  }
}

function calculateAverageExecutionTime(workflows: any[]): number {
  const completed = workflows.filter(w => w.status === 'completed' && w.completedAt);
  if (completed.length === 0) return 0;

  const totalTime = completed.reduce((sum, w) => {
    const start = new Date(w.startedAt).getTime();
    const end = new Date(w.completedAt!).getTime();
    return sum + (end - start);
  }, 0);

  return Math.round(totalTime / completed.length / 1000); // Return in seconds
}

function calculateStepSuccessRate(workflows: any[]): Record<string, { total: number; successful: number; failed: number }> {
  const stepStats: Record<string, { total: number; successful: number; failed: number }> = {};

  workflows.forEach(workflow => {
    workflow.steps.forEach((step: any) => {
      if (!stepStats[step.stepId]) {
        stepStats[step.stepId] = { total: 0, successful: 0, failed: 0 };
      }
      
      stepStats[step.stepId].total++;
      if (step.status === 'completed') {
        stepStats[step.stepId].successful++;
      } else if (step.status === 'failed') {
        stepStats[step.stepId].failed++;
      }
    });
  });

  return stepStats;
}

