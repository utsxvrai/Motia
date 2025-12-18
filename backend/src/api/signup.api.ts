import { Request, Response } from 'express';
import { motia } from '../motia/motia';
import { SignupRequest } from '../types/user';

export async function signupHandler(req: Request, res: Response) {
  try {
    const signupRequest: SignupRequest = req.body;

    if (!signupRequest.email || !signupRequest.name) {
      return res.status(400).json({
        error: 'Email and name are required',
      });
    }

    // Start the user signup workflow
    const execution = await motia.startWorkflow('user-signup', signupRequest);

    res.status(202).json({
      message: 'User signup workflow started',
      workflowId: execution.id,
      userId: execution.steps[0]?.output?.userId || 'pending',
      status: execution.status,
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      error: 'Failed to start signup workflow',
      message: (error as Error).message,
    });
  }
}

