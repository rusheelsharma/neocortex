import { useState, useRef, useEffect } from 'react';

// ============================================================================
// TYPES
// ============================================================================

interface Repo {
  name: string;
  desc: string;
  lang: string;
  stars: number;
  updated: string;
  private: boolean;
}

interface Entity {
  name: string;
  type: 'function' | 'interface' | 'class' | 'type';
  complexity: number;
  lines: number;
  file: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  context?: string;  // Code context for assistant messages
}

interface CodeContextUIProps {
  onGitHubSignIn?: (token: string) => Promise<{ name: string; avatar: string; login: string }>;
  onFetchRepos?: () => Promise<Repo[]>;
  onAnalyzeRepo?: (repoName: string) => Promise<Entity[]>;
  onAskQuestion?: (question: string, entities: Entity[]) => Promise<{ answer: string; context: string }>;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CodeContextUI({
  onGitHubSignIn,
  onFetchRepos,
  onAnalyzeRepo,
  onAskQuestion
}: CodeContextUIProps) {
  // Screen state
  const [screen, setScreen] = useState<'login' | 'repos' | 'analyze' | 'chat'>('login');
  
  // Auth state
  const [user, setUser] = useState<{ name: string; avatar: string; login: string } | null>(null);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [bootText, setBootText] = useState<string[]>([]);
  
  // Repos state
  const [repos, setRepos] = useState<Repo[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [repoSearch, setRepoSearch] = useState('');
  
  // Analysis state
  const [phase, setPhase] = useState<'idle' | 'analyzing' | 'complete'>('idle');
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [entities, setEntities] = useState<Entity[]>([]);
  
  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [expandedContext, setExpandedContext] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Boot sequence
  const bootSequence = [
    '> Initializing Neocortex...',
    '> Loading AST parser...',
    '> Connecting to embedding service...',
    '> Authenticating with GitHub...'
  ];

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleSignIn = async () => {
    if (!showTokenInput) {
      setShowTokenInput(true);
      return;
    }
    
    if (!tokenInput.trim()) {
      setTokenError('Please enter a token');
      return;
    }
    
    setIsSigningIn(true);
    setTokenError(null);
    setBootText([]);

    for (let i = 0; i < bootSequence.length; i++) {
      await new Promise(r => setTimeout(r, 400));
      setBootText(prev => [...prev, bootSequence[i]]);
    }

    try {
      const userData = await onGitHubSignIn?.(tokenInput);
      if (userData) {
        setBootText(prev => [...prev, `> Welcome, ${userData.name}.`]);
        await new Promise(r => setTimeout(r, 600));
        setUser(userData);
        
        setIsLoadingRepos(true);
        const repoData = await onFetchRepos?.() || [];
        setRepos(repoData);
        setIsLoadingRepos(false);
        
        setScreen('repos');
      }
    } catch (error: any) {
      setTokenError(error.message || 'Authentication failed');
      setBootText(prev => [...prev, `> ERROR: ${error.message}`]);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSelectRepo = (repoName: string) => {
    setSelectedRepo(repoName);
  };

  const handleAnalyze = async () => {
    if (!selectedRepo) return;
    
    setScreen('analyze');
    setPhase('analyzing');
    setProgress(0);
    setProgressMessage('Starting...');

    try {
      // Create a wrapper that captures progress
      const entityData = await new Promise<Entity[]>((resolve, reject) => {
        // We need to call the analyze function
        // The api.ts analyzeRepo accepts an onProgress callback
        // But our prop doesn't expose that, so we simulate progress
        let progressInterval = setInterval(() => {
          setProgress(p => Math.min(p + 2, 90));
        }, 200);

        onAnalyzeRepo?.(selectedRepo)
          .then(result => {
            clearInterval(progressInterval);
            setProgress(100);
            resolve(result);
          })
          .catch(err => {
            clearInterval(progressInterval);
            reject(err);
          });
      });
      
      setEntities(entityData);
      setPhase('complete');
      
      // Auto-transition to chat after a moment
      await new Promise(r => setTimeout(r, 1000));
      setScreen('chat');
      setMessages([{
        role: 'assistant',
        content: `Repository **${selectedRepo}** analyzed successfully!\n\nFound **${entityData.length}** code entities:\n- ${entityData.filter(e => e.type === 'function').length} functions\n- ${entityData.filter(e => e.type === 'class').length} classes\n- ${entityData.filter(e => e.type === 'interface').length} interfaces\n\nAsk me anything about the codebase.`
      }]);
    } catch (error: any) {
      console.error('Analysis failed:', error);
      setProgressMessage(`Error: ${error.message}`);
      setPhase('idle');
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isTyping) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsTyping(true);

    try {
      const response = await onAskQuestion?.(userMessage, entities);
      if (response) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: response.answer,
          context: response.context
        }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'No response' }]);
      }
    } catch (error: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error.message}` }]);
    } finally {
      setIsTyping(false);
    }
  };

  // Filter repos by search
  const filteredRepos = repos.filter(r => 
    r.name.toLowerCase().includes(repoSearch.toLowerCase()) ||
    r.desc.toLowerCase().includes(repoSearch.toLowerCase())
  );

  // ============================================================================
  // RENDER: LOGIN SCREEN
  // ============================================================================

  if (screen === 'login') {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Logo */}
          <div className="text-center space-y-4">
            <div className="text-6xl font-black tracking-tighter">
              <span className="text-cyan-400">NEO</span>
              <span className="text-white">CORTEX</span>
            </div>
            <p className="text-gray-500 text-sm tracking-widest uppercase">
              Intelligent Code Context Retrieval
            </p>
          </div>

          {/* Auth Section */}
          {!isSigningIn ? (
            <div className="space-y-6">
              {!showTokenInput ? (
                <button
                  onClick={handleSignIn}
                  className="w-full py-4 border-2 border-white/20 hover:border-cyan-500/50 bg-white/5 hover:bg-cyan-500/10 transition-all flex items-center justify-center gap-3 group"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                  </svg>
                  <span className="tracking-wider group-hover:text-cyan-400 transition-colors">
                    SIGN IN WITH GITHUB
                  </span>
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="text-sm text-gray-400 text-center">
                    Enter your GitHub Personal Access Token
                  </div>
                  <input
                    type="password"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSignIn()}
                    placeholder="ghp_xxxxxxxxxxxx"
                    className="w-full bg-transparent border-2 border-white/20 focus:border-cyan-500/50 px-4 py-3 text-center font-mono text-sm focus:outline-none"
                    autoFocus
                  />
                  {tokenError && (
                    <div className="text-red-400 text-xs text-center">{tokenError}</div>
                  )}
                  <button
                    onClick={handleSignIn}
                    className="w-full py-3 border-2 border-cyan-500 text-cyan-400 hover:bg-cyan-500/10 transition-all"
                  >
                    AUTHENTICATE
                  </button>
                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo&description=Neocortex"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xs text-center text-gray-600 hover:text-cyan-400 transition-colors"
                  >
                    Create a token →
                  </a>
                </div>
              )}
            </div>
          ) : (
            /* Boot sequence */
            <div className="font-mono text-sm space-y-1 text-green-400">
              {bootText.map((line, i) => (
                <div key={i} className="animate-pulse">{line}</div>
              ))}
              <span className="animate-pulse">_</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER: REPO SELECTION SCREEN
  // ============================================================================

  if (screen === 'repos') {
    return (
      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">
                <span className="text-cyan-400">NEO</span>CORTEX
              </h1>
              <p className="text-gray-500 text-sm">Select a repository to analyze</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gray-400 text-sm">{user?.login}</span>
              <div className="w-8 h-8 bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center text-cyan-400 font-bold">
                {user?.avatar}
              </div>
            </div>
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Search repositories..."
            value={repoSearch}
            onChange={(e) => setRepoSearch(e.target.value)}
            className="w-full bg-transparent border-2 border-white/10 focus:border-cyan-500/30 px-4 py-3 focus:outline-none"
          />

          {/* Repo List */}
          {isLoadingRepos ? (
            <div className="text-center text-gray-500 py-12">Loading repositories...</div>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {filteredRepos.map(repo => (
                <div
                  key={repo.name}
                  onClick={() => handleSelectRepo(repo.name)}
                  className={`p-4 border-2 cursor-pointer transition-all ${
                    selectedRepo === repo.name
                      ? 'border-cyan-500 bg-cyan-500/10'
                      : 'border-white/10 hover:border-white/30 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="font-medium flex items-center gap-2">
                        {repo.name}
                        {repo.private && (
                          <span className="text-xs px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                            PRIVATE
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">{repo.desc}</div>
                    </div>
                    <div className="text-right text-xs text-gray-600 space-y-1">
                      <div>{repo.lang}</div>
                      <div>⭐ {repo.stars}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Analyze Button */}
          {selectedRepo && (
            <button
              onClick={handleAnalyze}
              className="w-full py-4 bg-cyan-500 text-black font-bold tracking-wider hover:bg-cyan-400 transition-colors"
            >
              ANALYZE {selectedRepo.split('/')[1]?.toUpperCase()}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER: ANALYSIS SCREEN
  // ============================================================================

  if (screen === 'analyze') {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-8">
        <div className="w-full max-w-lg space-y-8 text-center">
          <div className="text-2xl font-bold">
            <span className="text-cyan-400">ANALYZING</span>
          </div>
          <div className="text-gray-400">{selectedRepo}</div>
          
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="h-1 bg-white/10 overflow-hidden">
              <div 
                className="h-full bg-cyan-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-xs text-gray-600">{progressMessage || `${progress}%`}</div>
          </div>

          {/* Stats */}
          {phase === 'complete' && (
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 border border-white/10">
                <div className="text-2xl font-bold text-cyan-400">
                  {entities.filter(e => e.type === 'function').length}
                </div>
                <div className="text-xs text-gray-500">FUNCTIONS</div>
              </div>
              <div className="p-4 border border-white/10">
                <div className="text-2xl font-bold text-cyan-400">
                  {entities.filter(e => e.type === 'class').length}
                </div>
                <div className="text-xs text-gray-500">CLASSES</div>
              </div>
              <div className="p-4 border border-white/10">
                <div className="text-2xl font-bold text-cyan-400">
                  {entities.filter(e => e.type === 'interface').length}
                </div>
                <div className="text-xs text-gray-500">INTERFACES</div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER: CHAT SCREEN
  // ============================================================================

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <div className="border-b border-white/10 p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold">
            <span className="text-cyan-400">NEO</span>CORTEX
          </h1>
          <span className="text-gray-500 text-sm">|</span>
          <span className="text-gray-400 text-sm">{selectedRepo}</span>
          <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 border border-green-500/30">
            {entities.length} entities
          </span>
        </div>
        <button
          onClick={() => {
            setScreen('repos');
            setSelectedRepo(null);
            setEntities([]);
            setMessages([]);
          }}
          className="text-gray-500 hover:text-white text-sm"
        >
          ← Back to repos
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`max-w-3xl ${msg.role === 'user' ? 'ml-auto' : ''}`}
          >
            <div
              className={`p-4 ${
                msg.role === 'user'
                  ? 'bg-cyan-500/10 border border-cyan-500/30'
                  : 'bg-white/5 border border-white/10'
              }`}
            >
              <div className="text-xs text-gray-500 mb-2">
                {msg.role === 'user' ? 'YOU' : 'NEOCORTEX'}
              </div>
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {msg.content}
              </div>
              
              {/* Code Context Toggle */}
              {msg.role === 'assistant' && msg.context && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <button
                    onClick={() => setExpandedContext(expandedContext === i ? null : i)}
                    className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-2"
                  >
                    <span>{expandedContext === i ? '▼' : '▶'}</span>
                    <span>{expandedContext === i ? 'Hide' : 'Show'} Code Context</span>
                    <span className="text-gray-500">({msg.context.length} chars)</span>
                  </button>
                  
                  {expandedContext === i && (
                    <pre className="mt-3 p-4 bg-black border border-white/10 text-xs text-gray-300 overflow-x-auto max-h-96 overflow-y-auto font-mono">
                      {msg.context}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="max-w-3xl">
            <div className="p-4 bg-white/5 border border-white/10">
              <div className="text-xs text-gray-500 mb-2">NEOCORTEX</div>
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-white/10 p-4">
        <div className="max-w-3xl mx-auto flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Ask about the codebase..."
            className="flex-1 bg-transparent border-2 border-white/10 focus:border-cyan-500/30 px-4 py-3 focus:outline-none"
            disabled={isTyping}
          />
          <button
            onClick={handleSendMessage}
            disabled={isTyping || !inputValue.trim()}
            className="px-6 py-3 bg-cyan-500 text-black font-bold hover:bg-cyan-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            SEND
          </button>
        </div>
      </div>
    </div>
  );
}
