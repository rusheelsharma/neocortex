import { useState, useEffect } from 'react';
import CodeContextUI from './CodeContextUI';
// API with MCP and Agent support
import {
  validateAndGetUser,
  fetchRepos,
  analyzeRepo,
  askQuestion,
  setGitHubToken,
  setUseMCP,
  setUseAgent,
  getUseAgent
} from './api';

export default function App() {
  const [currentRepo, setCurrentRepo] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [mcpStatus, setMcpStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [agentStatus, setAgentStatus] = useState<'checking' | 'available' | 'unavailable'>('checking');
  const [useMCPMode, setUseMCPMode] = useState(true); // Default to MCP
  const [useAgentMode, setUseAgentMode] = useState(getUseAgent()); // Default ON

  // Check server status on mount
  useEffect(() => {
    // Check local server
    fetch('http://localhost:3001/api/health')
      .then(res => res.ok ? setServerStatus('online') : setServerStatus('offline'))
      .catch(() => setServerStatus('offline'));
    
    // Check MCP server (via proxy)
    fetch('http://localhost:3001/api/mcp/health')
      .then(res => res.ok ? setMcpStatus('online') : setMcpStatus('offline'))
      .catch(() => setMcpStatus('offline'));
    
    // Check Agent status (has OpenAI key in .env?)
    fetch('http://localhost:3001/api/agent/status')
      .then(res => res.json())
      .then(data => setAgentStatus(data.available ? 'available' : 'unavailable'))
      .catch(() => setAgentStatus('unavailable'));
  }, []);

  // Toggle MCP mode
  const toggleMCPMode = () => {
    const newValue = !useMCPMode;
    setUseMCPMode(newValue);
    setUseMCP(newValue);
  };

  // Toggle Agent mode (LLM formats results - uses OPENAI_API_KEY from .env)
  const toggleAgentMode = () => {
    const newValue = !useAgentMode;
    setUseAgentMode(newValue);
    setUseAgent(newValue);
  };

  // GitHub sign-in handler - uses local Express server
  const handleGitHubSignIn = async (token: string) => {
    setGitHubToken(token);
    return await validateAndGetUser(token);
  };

  // Fetch repos handler - uses local Express server
  const handleFetchRepos = async () => {
    return await fetchRepos();
  };

  // Analyze repo handler - uses local Express server
  const handleAnalyzeRepo = async (repoName: string) => {
    setCurrentRepo(repoName);
    return await analyzeRepo(repoName);
  };

  // Ask question handler - uses agent mode by default
  const handleAskQuestion = async (question: string) => {
    if (!currentRepo) throw new Error('No repo selected');
    const result = await askQuestion(currentRepo, question, 2000);
    return { answer: result.answer, context: result.context };
  };

  return (
    <>
      {/* Status badges */}
      <div style={{
        position: 'fixed',
        top: 10,
        right: 10,
        display: 'flex',
        gap: 8,
        zIndex: 1000
      }}>
        <div style={{
          padding: '4px 8px',
          borderRadius: 4,
          fontSize: 12,
          background: serverStatus === 'online' ? '#22c55e' : serverStatus === 'offline' ? '#ef4444' : '#f59e0b',
          color: 'white'
        }}>
          Server: {serverStatus}
        </div>
        <div 
          onClick={toggleMCPMode}
          style={{
            padding: '4px 8px',
            borderRadius: 4,
            fontSize: 12,
            background: useMCPMode 
              ? (mcpStatus === 'online' ? '#3b82f6' : '#ef4444')
              : '#6b7280',
            color: 'white',
            cursor: 'pointer',
            border: useMCPMode ? '2px solid #60a5fa' : '2px solid transparent'
          }}
          title="Click to toggle between MCP server and local processing"
        >
          MCP: {useMCPMode ? (mcpStatus === 'online' ? 'ON' : 'ERR') : 'OFF'}
        </div>
        <div 
          onClick={toggleAgentMode}
          style={{
            padding: '4px 8px',
            borderRadius: 4,
            fontSize: 12,
            background: useAgentMode 
              ? (agentStatus === 'available' ? '#8b5cf6' : '#ef4444')
              : '#6b7280',
            color: 'white',
            cursor: 'pointer',
            border: useAgentMode ? '2px solid #a78bfa' : '2px solid transparent'
          }}
          title={agentStatus === 'available' 
            ? "Agent ON: LLM formats results (uses OPENAI_API_KEY from .env)" 
            : "Agent unavailable: Add OPENAI_API_KEY to .env"}
        >
          🤖 Agent: {useAgentMode ? (agentStatus === 'available' ? 'ON' : 'NO KEY') : 'OFF'}
        </div>
      </div>

      {/* Agent status tooltip - shows when agent unavailable */}
      {agentStatus === 'unavailable' && useAgentMode && (
        <div style={{
          position: 'fixed',
          top: 50,
          right: 10,
          background: '#1f2937',
          border: '1px solid #ef4444',
          borderRadius: 8,
          padding: 16,
          zIndex: 1001,
          width: 280
        }}>
          <h3 style={{ margin: '0 0 12px', color: '#f87171', fontSize: 14 }}>⚠️ Agent Unavailable</h3>
          <p style={{ margin: '0 0 12px', color: '#9ca3af', fontSize: 12 }}>
            Add <code style={{ background: '#374151', padding: '2px 4px', borderRadius: 2 }}>OPENAI_API_KEY</code> to your <code style={{ background: '#374151', padding: '2px 4px', borderRadius: 2 }}>.env</code> file and restart the server.
          </p>
          <p style={{ margin: '0', color: '#6b7280', fontSize: 11 }}>
            Without it, you'll still get code search results (just not AI-formatted).
          </p>
        </div>
      )}

      <CodeContextUI
        onGitHubSignIn={handleGitHubSignIn}
        onFetchRepos={handleFetchRepos}
        onAnalyzeRepo={handleAnalyzeRepo}
        onAskQuestion={handleAskQuestion}
      />
    </>
  );
}
