import { Request, Response } from 'express';
import { motia } from '../motia/motia';
import { database } from '../storage/database';

export async function verifyHandler(req: Request, res: Response) {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        error: 'Verification token is required',
      });
    }

    // Find user by token
    const userId = database.getUserIdByToken(token);
    if (!userId) {
      return res.status(404).json({
        error: 'Invalid or expired verification token',
      });
    }

    // Find the workflow for this user
    const workflowId = database.getWorkflowByUserId(userId);
    if (!workflowId) {
      return res.status(404).json({
        error: 'Workflow not found for this user',
      });
    }

    const userWorkflow = database.getWorkflow(workflowId);
    if (!userWorkflow) {
      return res.status(404).json({
        error: 'Workflow execution not found',
      });
    }

    // Signal the workflow to resume
    await motia.signalWorkflow(workflowId, 'verified', { userId });

    // Clean up the token
    database.deleteVerificationToken(token);

    res.json({
      message: 'Email verified successfully',
      userId,
      workflowId: workflowId,
    });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({
      error: 'Failed to verify email',
      message: (error as Error).message,
    });
  }
}

