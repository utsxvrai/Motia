import { StepDefinition } from '../types/workflow';
import { database } from '../storage/database';
import { emailService } from '../services/emailService';

function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Track sent emails per workflow to prevent duplicates (idempotency)
const sentEmailsPerWorkflow = new Map<string, Set<string>>();

export const sendVerificationEmailStep: StepDefinition = {
  id: 'send-verification-email',
  name: 'Send Verification Email',
  handler: async (context) => {
    const { userId, user } = context.input as { userId: string; user: any };

    context.log('Preparing to send verification email', { 
      userId, 
      email: user.email,
      usingService: (process.env.GMAIL_USER || process.env.SMTP_HOST) ? 'SMTP (Nodemailer)' : 'Mock (No SMTP Config)'
    });

    // Check if email was already sent for this workflow (idempotency check)
    const workflowEmails = sentEmailsPerWorkflow.get(context.workflowId) || new Set();
    if (workflowEmails.has(userId)) {
      context.log('Email already sent for this workflow, skipping duplicate', { userId });
      // Get existing token from database
      const existingToken = context.getState('verificationToken');
      if (existingToken) {
        return {
          output: {
            ...context.input,
            verificationToken: existingToken,
          },
        };
      }
    }

    // Generate verification token
    const token = uuidv4();
    database.setVerificationToken(token, userId, 24); // 24 hour expiry

    try {
      // Send real verification email via Resend API
      await emailService.sendVerificationEmail(user.email, token, user.name);

      // Mark as sent for this workflow
      if (!sentEmailsPerWorkflow.has(context.workflowId)) {
        sentEmailsPerWorkflow.set(context.workflowId, new Set());
      }
      sentEmailsPerWorkflow.get(context.workflowId)!.add(userId);
      context.setState('verificationToken', token);

      context.log('Verification email sent successfully', { 
        userId,
        email: user.email,
      });

      return {
        output: {
          ...context.input,
          verificationToken: token,
        },
      };
    } catch (error) {
      const errorMessage = (error as Error).message;
      context.log('Email sending failed', { userId, error: errorMessage });
      
      // Re-throw to trigger retry mechanism
      throw new Error(`Failed to send verification email: ${errorMessage}`);
    }
  },
  retryPolicy: {
    maxAttempts: 5, // Email failures should retry more
    backoffMs: 2000, // Exponential backoff for rate limits
  },
};

