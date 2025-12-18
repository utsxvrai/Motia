import { WorkflowDefinition } from '../types/workflow';
import { createUserStep } from '../steps/createUser.step';
import { sendVerificationEmailStep } from '../steps/sendVerificationEmail.step';
import { waitForVerificationStep } from '../steps/waitForVerification.step';
import { aiRiskCheckStep } from '../steps/aiRiskCheck.step';
import { finalizeUserStep } from '../steps/finalizeUser.step';

export const userSignupWorkflow: WorkflowDefinition = {
    id: 'user-signup',
    name: 'User Signup Workflow',
    steps: [
        createUserStep,
        sendVerificationEmailStep,
        waitForVerificationStep,
        aiRiskCheckStep,
        finalizeUserStep,
    ],
};

