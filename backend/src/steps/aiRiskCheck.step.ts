import { StepDefinition } from '../types/workflow';
import { RiskDecision } from '../types/user';
import { database } from '../storage/database';
import { aiRiskService } from '../services/aiRiskService';

export const aiRiskCheckStep: StepDefinition = {
  id: 'ai-risk-check',
  name: 'AI Risk Check',
  handler: async (context) => {
    const { userId, user } = context.input as { userId: string; user: any };

    context.log('Starting AI risk assessment', { 
      userId, 
      email: user.email,
      usingAI: process.env.GEMINI_API_KEY ? 'Google Gemini AI' : 'Mock (No API Key)'
    });

    try {
      // Call production AI risk service
      const assessment = await aiRiskService.assessRisk({
        email: user.email,
        name: user.name,
        createdAt: user.createdAt || new Date(),
      });

      context.log('AI risk assessment completed', {
        userId,
        riskScore: assessment.riskScore.toFixed(3),
        decision: assessment.decision,
        reasoning: assessment.reasoning,
        confidence: assessment.confidence.toFixed(2),
      });

      // Persist decision with additional metadata
      database.updateUser(userId, {
        riskDecision: assessment.decision,
        riskCheckAt: new Date(),
        riskScore: assessment.riskScore,
        riskReasoning: assessment.reasoning,
        riskConfidence: assessment.confidence,
      });

      return {
        output: {
          ...context.input,
          riskDecision: assessment.decision,
          riskScore: assessment.riskScore,
          riskReasoning: assessment.reasoning,
          riskConfidence: assessment.confidence,
        },
      };
    } catch (error) {
      const errorMessage = (error as Error).message;
      context.log('AI risk assessment error', { 
        userId, 
        error: errorMessage 
      });
      
      // Re-throw to trigger retry mechanism
      throw new Error(`AI risk check failed: ${errorMessage}`);
    }
  },
  retryPolicy: {
    maxAttempts: 3,
    backoffMs: 2000, // Exponential backoff for API rate limits
  },
};

