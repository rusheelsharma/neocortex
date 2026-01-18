// ============================================================================
// FILE: src/ui/agent.ts
// PURPOSE: LLM-driven agent that decides which MCP tools to call
// ============================================================================

const API_URL = 'http://localhost:3001/api';

// MCP Tool definitions for the LLM
const MCP_TOOLS = [
  {
    type: "function",
    function: {
      name: "search_code",
      description: "Search the indexed codebase using semantic similarity or keyword matching. Use this to find code related to a concept, feature, or question.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Natural language search query (e.g., 'authentication flow', 'how tags are created')"
          },
          maxTokens: {
            type: "number",
            description: "Maximum tokens in response (default: 2000)"
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "resolve_symbol",
      description: "Find the exact definition of a specific function, class, or variable by name. Use this when you know the exact name of something.",
      parameters: {
        type: "object",
        properties: {
          symbol: {
            type: "string",
            description: "Exact symbol name (e.g., 'handleTagSubmit', 'UserContext', 'isLoading')"
          }
        },
        required: ["symbol"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_snippet",
      description: "Get code from a specific file and line range. Use this when you know the exact location from previous search results.",
      parameters: {
        type: "object",
        properties: {
          filePath: {
            type: "string",
            description: "Path to the file"
          },
          startLine: {
            type: "number",
            description: "Starting line number"
          },
          endLine: {
            type: "number",
            description: "Ending line number"
          }
        },
        required: ["filePath", "startLine", "endLine"]
      }
    }
  }
];

// Optimized system prompt - shorter = faster
const SYSTEM_PROMPT = `You are Neocortex, a code search assistant. Use tools to find relevant code, then explain it briefly.

Tools:
- search_code: Find code by concept/feature (use this first)
- resolve_symbol: Get exact function/class definition by name
- get_snippet: Get code from specific file/lines

Be concise. Reference files and line numbers. One tool call is usually enough.`;

interface AgentConfig {
  provider: 'openai' | 'anthropic';
  apiKey: string;
  model?: string;
}

let agentConfig: AgentConfig | null = null;
let currentRepoId: string | null = null;

export function configureAgent(config: AgentConfig) {
  agentConfig = config;
}

export function setAgentRepoId(repoId: string) {
  currentRepoId = repoId;
}

export function isAgentConfigured(): boolean {
  return agentConfig !== null && !!agentConfig.apiKey;
}

// Execute an MCP tool via our local proxy
async function executeTool(name: string, args: any): Promise<any> {
  if (!currentRepoId) {
    return { error: 'No repository indexed' };
  }

  console.log(`[Agent] Executing tool: ${name}`, args);

  try {
    switch (name) {
      case 'search_code': {
        const res = await fetch(`${API_URL}/mcp/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repoId: currentRepoId,
            query: args.query,
            maxTokens: args.maxTokens || 2000
          })
        });
        return await res.json();
      }
      case 'resolve_symbol': {
        const res = await fetch(`${API_URL}/mcp/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repoId: currentRepoId,
            symbol: args.symbol
          })
        });
        return await res.json();
      }
      case 'get_snippet': {
        const res = await fetch(`${API_URL}/mcp/snippet`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repoId: currentRepoId,
            filePath: args.filePath,
            startLine: args.startLine,
            endLine: args.endLine
          })
        });
        return await res.json();
      }
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (error: any) {
    return { error: error.message };
  }
}

// Main agent function - LLM decides which tools to call
export async function askAgent(question: string): Promise<{
  answer: string;
  toolCalls: { tool: string; args: any; result: any }[];
  context: string;
}> {
  if (!agentConfig) {
    throw new Error('Agent not configured. Please add an API key.');
  }

  const toolCalls: { tool: string; args: any; result: any }[] = [];
  let context = '';

  // Initial message to LLM
  const messages: any[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: question }
  ];

  // Agent loop - let LLM call tools until it has enough info
  // Reduced to 2 iterations for speed (1 tool call + 1 answer)
  let iterations = 0;
  const maxIterations = 2;

  while (iterations < maxIterations) {
    iterations++;
    console.log(`[Agent] Iteration ${iterations}`);

    // Call LLM
    const response = await callLLM(messages);
    
    // Check if LLM wants to call tools
    if (response.toolCalls && response.toolCalls.length > 0) {
      // Execute each tool call
      for (const toolCall of response.toolCalls) {
        const result = await executeTool(toolCall.name, toolCall.arguments);
        toolCalls.push({
          tool: toolCall.name,
          args: toolCall.arguments,
          result
        });

        // Add context from search results
        if (result.context) {
          context += result.context + '\n\n';
        }

        // Add tool result to messages for next iteration
        messages.push({
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: toolCall.id,
            type: 'function',
            function: { name: toolCall.name, arguments: JSON.stringify(toolCall.arguments) }
          }]
        });
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result, null, 2).slice(0, 4000) // Truncate large results
        });
      }
    } else {
      // LLM is done, return final answer
      return {
        answer: response.content || "I couldn't generate an answer.",
        toolCalls,
        context
      };
    }
  }

  // Max iterations reached
  return {
    answer: "I gathered some information but reached the analysis limit. Here's what I found based on the tool calls.",
    toolCalls,
    context
  };
}

// Call LLM (OpenAI or Anthropic)
async function callLLM(messages: any[]): Promise<{
  content: string | null;
  toolCalls: { id: string; name: string; arguments: any }[] | null;
}> {
  if (!agentConfig) throw new Error('Agent not configured');

  if (agentConfig.provider === 'openai') {
    return callOpenAI(messages);
  } else {
    return callAnthropic(messages);
  }
}

async function callOpenAI(messages: any[]): Promise<{
  content: string | null;
  toolCalls: { id: string; name: string; arguments: any }[] | null;
}> {
  // Use fast model with optimized settings
  const model = agentConfig!.model || 'gpt-4o-mini';
  console.log(`[Agent] Calling ${model}...`);
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${agentConfig!.apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      tools: MCP_TOOLS,
      tool_choice: 'auto',
      max_tokens: 500,      // Reduced for speed
      temperature: 0        // Deterministic = faster
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const message = data.choices[0].message;

  if (message.tool_calls) {
    return {
      content: null,
      toolCalls: message.tool_calls.map((tc: any) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments)
      }))
    };
  }

  return {
    content: message.content,
    toolCalls: null
  };
}

async function callAnthropic(messages: any[]): Promise<{
  content: string | null;
  toolCalls: { id: string; name: string; arguments: any }[] | null;
}> {
  // Convert messages to Anthropic format
  const systemMsg = messages.find(m => m.role === 'system')?.content || '';
  const otherMessages = messages.filter(m => m.role !== 'system').map(m => {
    if (m.role === 'tool') {
      return { role: 'user', content: `Tool result: ${m.content}` };
    }
    return m;
  });

  // Convert tools to Anthropic format
  const anthropicTools = MCP_TOOLS.map(t => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters
  }));

  // Use fast Haiku model
  const model = agentConfig!.model || 'claude-3-5-haiku-latest';
  console.log(`[Agent] Calling ${model}...`);
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': agentConfig!.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: 500,  // Reduced for speed
      system: systemMsg,
      messages: otherMessages,
      tools: anthropicTools
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  
  // Check for tool use
  const toolUse = data.content.find((c: any) => c.type === 'tool_use');
  if (toolUse) {
    return {
      content: null,
      toolCalls: [{
        id: toolUse.id,
        name: toolUse.name,
        arguments: toolUse.input
      }]
    };
  }

  // Return text content
  const textContent = data.content.find((c: any) => c.type === 'text');
  return {
    content: textContent?.text || null,
    toolCalls: null
  };
}

