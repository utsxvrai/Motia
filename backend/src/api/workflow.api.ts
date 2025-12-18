import { Request, Response } from 'express';
import { motia } from '../motia/motia';

export async function getWorkflowHandler(req: Request, res: Response) {
  try {
    const { workflowId } = req.params;

    const workflow = motia.getWorkflow(workflowId);

    if (!workflow) {
      return res.status(404).json({
        error: 'Workflow not found',
      });
    }

    // Include step outputs and logs for frontend
    const workflowWithOutputs = {
      ...workflow,
      steps: workflow.steps.map(s => ({
        ...s,
        output: s.output, // Include output in response
        logs: s.logs || [], // Include logs for real-time display
      })),
    };
    
    res.json(workflowWithOutputs);
  } catch (error) {
    console.error('Get workflow error:', error);
    res.status(500).json({
      error: 'Failed to get workflow',
      message: (error as Error).message,
    });
  }
}

export async function listWorkflowsHandler(_req: Request, res: Response) {
  try {
    const { database } = await import('../storage/database');
    const workflows = database.getAllWorkflows();

    res.json({
      workflows: workflows.map(w => ({
        id: w.id,
        workflowId: w.workflowId,
        status: w.status,
        currentStep: w.currentStep,
        startedAt: w.startedAt,
        completedAt: w.completedAt,
        steps: w.steps.map(s => ({
          stepId: s.stepId,
          status: s.status,
          attempts: s.attempts,
          startedAt: s.startedAt,
          completedAt: s.completedAt,
          output: s.output, // Include output for verification token access
        })),
      })),
    });
  } catch (error) {
    console.error('List workflows error:', error);
    res.status(500).json({
      error: 'Failed to list workflows',
      message: (error as Error).message,
    });
  }
}

