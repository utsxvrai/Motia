import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { motia } from './motia/motia';
import { userSignupWorkflow } from './workflows/userSignup.workflow';
import { signupHandler } from './api/signup.api';
import { verifyHandler } from './api/verify.api';
import { getWorkflowHandler, listWorkflowsHandler } from './api/workflow.api';
import { getMetricsHandler } from './api/metrics.api';
import { database } from './storage/database';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
// Allow both with and without trailing slash to be safe
const allowedOrigins = [
  clientUrl,
  clientUrl.endsWith('/') ? clientUrl.slice(0, -1) : `${clientUrl}/`
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());

// Initialize Motia
motia.registerWorkflow(userSignupWorkflow);

console.log('✅ Motia runtime initialized');
console.log(`✅ Registered workflow: ${userSignupWorkflow.name}`);

// Log AI service status
if (process.env.GEMINI_API_KEY) {
  console.log('🤖 AI Risk Service: Using Google Gemini AI (Production Mode)');
} else {
  console.log('🤖 AI Risk Service: Using intelligent mock mode (No API key provided)');
  console.log('   💡 Set GEMINI_API_KEY in .env to enable real AI risk assessment');
  console.log('   💡 Get free API key at: https://makersuite.google.com/app/apikey');
}

// Log Email service status
if (process.env.GMAIL_USER || process.env.SMTP_HOST) {
  console.log('📧 Email Service: SMTP configured (Real emails enabled)');
} else {
  console.log('📧 Email Service: Using mock mode (No SMTP configured)');
  console.log('   💡 Easiest setup: Configure GMAIL_USER and GMAIL_APP_PASSWORD in .env');
  console.log('   💡 See EMAIL_SETUP.md for detailed instructions');
}

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.post('/api/signup', signupHandler);
app.get('/api/verify', verifyHandler);
app.get('/api/workflows', listWorkflowsHandler);
app.get('/api/workflows/:workflowId', getWorkflowHandler);
app.get('/api/metrics', getMetricsHandler);

// Get all users (for demo)
app.get('/api/users', (_req, res) => {
  const users = database.getAllUsers();
  res.json({ users });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`\n📋 Available endpoints:`);
  console.log(`   POST /api/signup - Start user signup workflow`);
  console.log(`   GET  /api/verify?token=<token> - Verify user email`);
  console.log(`   GET  /api/workflows - List all workflows`);
  console.log(`   GET  /api/workflows/:id - Get workflow details`);
  console.log(`   GET  /api/users - List all users`);
  console.log(`   GET  /api/metrics - Get system metrics and analytics`);
  console.log(`\n✨ Ready to process user signups!\n`);
});

