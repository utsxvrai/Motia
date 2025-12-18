import { StepDefinition } from '../types/workflow';

export const waitForVerificationStep: StepDefinition = {
  id: 'wait-for-verification',
  name: 'Wait for User Verification',
  handler: async (context) => {
    const { userId } = context.input as { userId: string };

    context.log('Checking for user verification', { userId });

    // Check if verification signal already received (durable wait)
    const verificationSignal = context.getState('signal:verified');
    if (verificationSignal && verificationSignal.userId === userId) {
      context.log('Verification signal received, proceeding', { userId });
      return {
        output: {
          ...context.input,
          verified: true,
          verifiedAt: verificationSignal.timestamp || new Date(),
        },
      };
    }

    // This step will pause the workflow until signaled
    // In a real Motia implementation, this would be handled by the runtime
    context.log('WORKFLOW_PAUSED_WAITING_FOR_SIGNAL: verified', { userId });
    context.setState('waitingForVerification', true);
    context.setState('waitingUserId', userId);

    // Throw a special error to indicate this is a wait, not a failure
    // The runtime should handle this by pausing the workflow
    throw new Error('WORKFLOW_PAUSED_WAITING_FOR_SIGNAL:verified');
  },
  // No retry policy for waits - they wait until signaled
};

