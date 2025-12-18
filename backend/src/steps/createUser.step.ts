import { StepDefinition } from '../types/workflow';
import { User, UserStatus, SignupRequest } from '../types/user';
import { database } from '../storage/database';

function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const createUserStep: StepDefinition = {
  id: 'create-user',
  name: 'Create User',
  handler: async (context) => {
    const { email, name } = context.input as SignupRequest;

    context.log('Creating user account', { email, name });

    // Validate input
    if (!email || !name) {
      throw new Error('Email and name are required');
    }

    // Check if user already exists
    const existingUser = database.getUserByEmail(email);
    if (existingUser) {
      throw new Error(`User with email ${email} already exists`);
    }

    // Create new user
    const user: User = {
      id: uuidv4(),
      email,
      name,
      status: UserStatus.PENDING,
      createdAt: new Date(),
    };

    database.createUser(user);
    
    // Link user to workflow
    database.setUserWorkflow(user.id, context.workflowId);
    
    context.log('User created successfully', { userId: user.id });

    return {
      output: {
        userId: user.id,
        user,
      },
    };
  },
  retryPolicy: {
    maxAttempts: 3,
    backoffMs: 500,
  },
};

