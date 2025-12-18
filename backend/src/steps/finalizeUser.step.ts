import { StepDefinition } from '../types/workflow';
import { UserStatus, RiskDecision } from '../types/user';
import { database } from '../storage/database';

export const finalizeUserStep: StepDefinition = {
  id: 'finalize-user',
  name: 'Finalize User',
  handler: async (context) => {
    const { userId, riskDecision, verifiedAt } = context.input as {
      userId: string;
      riskDecision: RiskDecision;
      verifiedAt?: Date;
    };

    context.log('Finalizing user account', { userId, riskDecision });

    const user = database.getUser(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // Determine final status based on risk decision
    const finalStatus =
      riskDecision === RiskDecision.ALLOW ? UserStatus.ACTIVE : UserStatus.FLAGGED;

    database.updateUser(userId, {
      status: finalStatus,
      verifiedAt: verifiedAt || new Date(),
    });

    context.log('User account finalized', {
      userId,
      status: finalStatus,
      riskDecision,
    });

    return {
      output: {
        ...context.input,
        finalStatus,
        completed: true,
      },
    };
  },
  retryPolicy: {
    maxAttempts: 3,
    backoffMs: 500,
  },
};

