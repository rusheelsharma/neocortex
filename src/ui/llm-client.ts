// ============================================================================
// FILE: src/ui/llm-client.ts
// PURPOSE: Send MCP search results to LLM for intelligent explanations
// ============================================================================

const SYSTEM_PROMPT = `You are Neocortex, a code analysis assistant. 
You receive code search results and explain them clearly to developers.

Guidelines:
- Be concise but thorough
- Explain what the code does, not just what it is
- Reference specific functions and files
- Suggest follow-up questions if relevant
- Use markdown formatting`;

interface LLMConfig {
  provider: 'openai' | 'anthropic';
  apiKey: string;
  model: string;
}

let config: LLMConfig | null = null;

/**
 * Configure the LLM provider
 */
export function configureLLM(newConfig: LLMConfig) {
  config = newConfig;
  // Store in sessionStorage for persistence
  sessionStorage.setItem('llm_config', JSON.stringify({
    provider: newConfig.provider,
    model: newConfig.model
    // Don't store API key in sessionStorage for security
  }));
}

/**
 * Check if LLM is configured
 */
export function isLLMConfigured(): boolean {
  return config !== null && !!config.apiKey;
}

/**
 * Get LLM config (without API key)
 */
export function getLLMConfig(): { provider: string; model: string } | null {
  if (!config) return null;
  return { provider: config.provider, model: config.model };
}

/**
 * Generate explanation for code search results
 */
export async function explainSearchResults(
  question: string,
  codeContext: string,
  entities: string[]
): Promise<string> {
  if (!config || !config.apiKey) {
    // Return without LLM processing
    return '';
  }

  const userMessage = `User asked: "${question}"

Found these code entities: ${entities.join(', ')}

Code context:
\`\`\`
${codeContext.slice(0, 4000)}
\`\`\`

Explain this code and answer the user's question.`;

  try {
    if (config.provider === 'openai') {
      return await callOpenAI(userMessage);
    } else if (config.provider === 'anthropic') {
      return await callAnthropic(userMessage);
    }
    return '';
  } catch (error) {
    console.error('LLM error:', error);
    return '';
  }
}

async function callOpenAI(userMessage: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config!.apiKey}`
    },
    body: JSON.stringify({
      model: config!.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage }
      ],
      max_tokens: 800,
      temperature: 0.3
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callAnthropic(userMessage: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config!.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: config!.model,
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }]
    })
  });

  if (!response.ok) {
    throw new Error(`Anthropic error: ${response.status}`);
  }

  const data = await response.json();
  return data.content[0].text;
}
