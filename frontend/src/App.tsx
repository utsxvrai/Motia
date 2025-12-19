import { useState, useEffect } from 'react';
import './App.css';


interface SignupRequest {
  email: string;
  name: string;
}

interface WorkflowStep {
  stepId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'retrying';
  attempts: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  output?: any;
  logs?: Array<{ timestamp: string; message: string; data?: any }>;
}

interface Workflow {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  currentStep?: string;
  startedAt: string;
  completedAt?: string;
  steps: WorkflowStep[];
}

interface LogEntry {
  timestamp: string;
  stepId: string;
  stepName: string;
  message: string;
  status: string;
}

function App() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<{
    status: 'idle' | 'verifying' | 'success' | 'error';
    message: string;
  }>({ status: 'idle', message: '' });
  const [stepLogs, setStepLogs] = useState<LogEntry[]>([]);
  const [metrics, setMetrics] = useState<any>(null);

  // API URL from environment variables
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  // Check for verification token in URL on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    
    if (tokenFromUrl) {
      // Remove token from URL for cleaner address bar
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Auto-verify the token
      handleAutoVerify(tokenFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (workflowId) {
      const interval = setInterval(() => {
        fetchWorkflow(workflowId);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [workflowId]);

  useEffect(() => {
    fetchUsers();
    fetchMetrics();
    const metricsInterval = setInterval(fetchMetrics, 5000); // Update every 5 seconds
    return () => clearInterval(metricsInterval);
  }, []);

  const fetchMetrics = async () => {
    try {
      const response = await fetch(`${API_URL}/api/metrics`);
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  };

  // Update step logs when workflow changes
  useEffect(() => {
    if (workflow) {
      const logs: LogEntry[] = [];
      
      workflow.steps.forEach((step) => {
        const stepName = getStepName(step.stepId);
        
        // Add step status log
        if (step.status !== 'pending') {
          logs.push({
            timestamp: step.startedAt || workflow.startedAt,
            stepId: step.stepId,
            stepName,
            message: `${stepName}: ${step.status}`,
            status: step.status,
          });
        }
        
        // Add step logs if available
        if (step.logs && Array.isArray(step.logs)) {
          step.logs.forEach((log) => {
            logs.push({
              timestamp: log.timestamp,
              stepId: step.stepId,
              stepName,
              message: log.message,
              status: step.status,
            });
          });
        }
        
        // Add error if present
        if (step.error) {
          logs.push({
            timestamp: step.completedAt || new Date().toISOString(),
            stepId: step.stepId,
            stepName,
            message: `Error: ${step.error}`,
            status: 'failed',
          });
        }
      });
      
      // Sort by timestamp
      logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      setStepLogs(logs);
    }
  }, [workflow]);

  const fetchWorkflow = async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/api/workflows/${id}`);
      if (response.ok) {
        const data = await response.json();
        setWorkflow(data);
      }
    } catch (error) {
      console.error('Error fetching workflow:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_URL}/api/users`);
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setWorkflowId(null);
    setWorkflow(null);
    setStepLogs([]);
    setVerificationStatus({ status: 'idle', message: '' });

    try {
      const response = await fetch(`${API_URL}/api/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, name } as SignupRequest),
      });

      const data = await response.json();
      if (response.ok) {
        setWorkflowId(data.workflowId);
        fetchWorkflow(data.workflowId);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      alert(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoVerify = async (token: string) => {
    setVerificationStatus({ status: 'verifying', message: 'Verifying email...' });

    try {
      const response = await fetch(`${API_URL}/api/verify?token=${token}`);
      const data = await response.json();
      
      if (response.ok) {
        setVerificationStatus({
          status: 'success',
          message: 'Email verified successfully! The workflow will continue.',
        });
        
        if (data.workflowId) {
          setWorkflowId(data.workflowId);
          fetchWorkflow(data.workflowId);
        }
        
        fetchUsers();
        
        // Auto-hide success message after 5 seconds
        setTimeout(() => {
          setVerificationStatus({ status: 'idle', message: '' });
        }, 5000);
      } else {
        setVerificationStatus({
          status: 'error',
          message: data.error || 'Verification failed. Please try again.',
        });
      }
    } catch (error) {
      setVerificationStatus({
        status: 'error',
        message: `Error: ${error}`,
      });
    }
  };

  const getStepStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return '✅';
      case 'running':
      case 'retrying':
        return '⏳';
      case 'failed':
        return '❌';
      default:
        return '⏸️';
    }
  };

  const getStepName = (stepId: string) => {
    const names: Record<string, string> = {
      'create-user': '1. Create User',
      'send-verification-email': '2. Send Verification Email',
      'wait-for-verification': '3. Wait for Verification',
      'ai-risk-check': '4. AI Risk Check',
      'finalize-user': '5. Finalize User',
    };
    return names[stepId] || stepId;
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  return (
    <div className="app">
      <div className="container">
        <header>
          <h1>🚀 Motia User Lifecycle Demo</h1>
          <p>Unified Backend Workflow - No Queues, No Workers, No Cron Jobs</p>
        </header>

        <div className="content">
          {/* Verification Status Banner */}
          {verificationStatus.status !== 'idle' && (
            <div className={`verification-banner ${verificationStatus.status}`}>
              {verificationStatus.status === 'verifying' && '⏳ '}
              {verificationStatus.status === 'success' && '✅ '}
              {verificationStatus.status === 'error' && '❌ '}
              {verificationStatus.message}
            </div>
          )}

          <section className="signup-section">
            <h2>User Signup</h2>
            <form onSubmit={handleSignup}>
              <div className="form-group">
                <label>Email:</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="user@example.com"
                />
              </div>
              <div className="form-group">
                <label>Name:</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="John Doe"
                />
              </div>
              <button type="submit" disabled={loading}>
                {loading ? 'Starting Workflow...' : 'Sign Up'}
              </button>
            </form>

            {/* Real-time Step Logs Card */}
            {(workflow || stepLogs.length > 0) && (
              <div className="logs-card">
                <h3>📋 Workflow Execution Log</h3>
                <div className="logs-container">
                  {stepLogs.length === 0 ? (
                    <div className="log-entry idle">
                      <span className="log-time">--:--:--</span>
                      <span className="log-message">Waiting for workflow to start...</span>
                    </div>
                  ) : (
                    stepLogs.map((log, index) => (
                      <div key={index} className={`log-entry ${log.status}`}>
                        <span className="log-time">{formatTime(log.timestamp)}</span>
                        <span className="log-step">{log.stepName}</span>
                        <span className="log-message">{log.message}</span>
                      </div>
                    ))
                  )}
                  {workflow?.status === 'completed' && (
                    <div className="log-entry completed">
                      <span className="log-time">{formatTime(workflow.completedAt || '')}</span>
                      <span className="log-step">Workflow</span>
                      <span className="log-message">✅ Workflow completed successfully!</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          {workflow && (
            <section className="workflow-section">
              <h2>Workflow Execution</h2>
              <div className="workflow-info">
                <p><strong>Status:</strong> <span className={`status-${workflow.status}`}>{workflow.status}</span></p>
                <p><strong>Workflow ID:</strong> <code>{workflow.id}</code></p>
                {workflow.currentStep && (
                  <p><strong>Current Step:</strong> {workflow.currentStep}</p>
                )}
              </div>

              <div className="steps">
                <h3>Steps:</h3>
                {workflow.steps.map((step, index) => (
                  <div key={step.stepId} className={`step ${step.status}`}>
                    <div className="step-header">
                      <span className="step-icon">{getStepStatusIcon(step.status)}</span>
                      <span className="step-name">{getStepName(step.stepId)}</span>
                      <span className="step-status">{step.status}</span>
                      {step.attempts > 1 && (
                        <span className="step-attempts">({step.attempts} attempts)</span>
                      )}
                    </div>
                    {step.error && (
                      <div className="step-error">Error: {step.error}</div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Metrics Dashboard */}
          {metrics && (
            <section className="metrics-section">
              <h2>📊 System Metrics & Analytics</h2>
              <div className="metrics-grid">
                <div className="metric-card">
                  <h3>Workflows</h3>
                  <div className="metric-value">{metrics.workflows.totalWorkflows}</div>
                  <div className="metric-details">
                    <span className="metric-item completed">✓ {metrics.workflows.completed} Completed</span>
                    <span className="metric-item running">⏳ {metrics.workflows.running} Running</span>
                    <span className="metric-item failed">✗ {metrics.workflows.failed} Failed</span>
                  </div>
                  {metrics.workflows.averageExecutionTime > 0 && (
                    <div className="metric-extra">
                      Avg Execution: {metrics.workflows.averageExecutionTime}s
                    </div>
                  )}
                </div>
                
                <div className="metric-card">
                  <h3>Users</h3>
                  <div className="metric-value">{metrics.users.totalUsers}</div>
                  <div className="metric-details">
                    <span className="metric-item active">✓ {metrics.users.active} Active</span>
                    <span className="metric-item flagged">⚠ {metrics.users.flagged} Flagged</span>
                    <span className="metric-item pending">⏳ {metrics.users.pending} Pending</span>
                  </div>
                </div>

                <div className="metric-card">
                  <h3>AI Risk Decisions</h3>
                  <div className="metric-value">{metrics.users.riskDistribution.allowed + metrics.users.riskDistribution.flagged}</div>
                  <div className="metric-details">
                    <span className="metric-item allowed">✓ {metrics.users.riskDistribution.allowed} Allowed</span>
                    <span className="metric-item risk-flagged">⚠ {metrics.users.riskDistribution.flagged} Flagged</span>
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="users-section">
            <h2>Users ({users.length})</h2>
            <div className="users-list">
              {users.map((user) => (
                <div key={user.id} className="user-card">
                  <div className="user-info">
                    <strong>{user.name}</strong>
                    <span>{user.email}</span>
                  </div>
                  <div className={`user-status status-${user.status.toLowerCase()}`}>
                    {user.status}
                  </div>
                  {user.riskDecision && (
                    <div className="risk-decision">
                      Risk: {user.riskDecision}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default App;
