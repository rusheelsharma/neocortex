# 🧠 Neocortex

> **Transform any GitHub repository into an intelligent, queryable knowledge base**

Neocortex uses AST parsing, vector embeddings, and dependency graph analysis to understand codebases deeply—enabling natural language questions like *"How does authentication work?"* and returning precisely the relevant code context.

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=flat-square&logo=openai&logoColor=white)](https://openai.com/)
[![React](https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black)](https://reactjs.org/)

---

## 🎯 What It Does

```
You: "How does the payment system handle refunds?"

Neocortex: Found 4 relevant functions:
  • processRefund() - payments/refund.ts
  • validateRefundRequest() - payments/validation.ts  
  • updateOrderStatus() - orders/status.ts [via dependency graph]
  • sendRefundNotification() - notifications/email.ts [via dependency graph]

[Returns actual code context ready for any LLM]
```

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| 🔍 **Semantic Search** | Natural language queries using OpenAI embeddings |
| 🕸️ **Dependency Graph** | Automatic call graph analysis for context expansion |
| 🎯 **Query Classification** | Detects query type (simple, architectural, debugging) and optimizes strategy |
| 📊 **Token Budgeting** | Smart compression to fit LLM context windows |
| 🔐 **Security Layer** | Rate limiting, audit logging, token sanitization |
| 🖥️ **Dual Interface** | CLI for power users, Web UI for visual exploration |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- pnpm
- OpenAI API key

### Installation

```bash
git clone https://github.com/yourusername/neocortex.git
cd neocortex
pnpm install
```

### Set up environment

```bash
# Create .env file with your API key
echo "OPENAI_API_KEY=sk-your-key-here" > .env

# Optional: For private repos
echo "GITHUB_TOKEN=ghp_your-token" >> .env
```

### Try it out

```bash
# Query any public repo
pnpm dev context https://github.com/sindresorhus/is "what types are exported"

# Query with more context
pnpm dev context https://github.com/user/repo "how does auth work" --max-tokens 3000
```

---

## 📖 Usage

### CLI Commands

#### `context` — Query a codebase
```bash
pnpm dev context <repo-url> "<question>" [options]

# Examples
pnpm dev context https://github.com/user/repo "how does login work"
pnpm dev context https://github.com/user/repo "what calls the database" --max-tokens 4000
pnpm dev context https://github.com/user/private-repo "show me the API" -t ghp_token
```

**Options:**
| Flag | Description | Default |
|------|-------------|---------|
| `--max-tokens <n>` | Token budget for context | 2000 |
| `--top-k <n>` | Number of candidates | 10 |
| `--model <m>` | `openai` or `voyage-code-2` | openai |
| `-t, --token` | GitHub token for private repos | — |

#### `generate` — Create training data
```bash
pnpm dev generate https://github.com/user/repo -o ./output/data.jsonl
```

#### `graph` — Analyze dependencies
```bash
pnpm dev graph https://github.com/user/repo --expand functionName
```

### Web UI

```bash
# Terminal 1: API Server
pnpm server

# Terminal 2: Frontend  
pnpm ui

# Open http://localhost:5173
```

---

## 🔬 How It Works

```
┌──────────────────────────────────────────────────────────────────────┐
│                        NEOCORTEX PIPELINE                            │
│                                                                      │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐          │
│  │  CLONE  │───▶│  PARSE  │───▶│  GRAPH  │───▶│  EMBED  │          │
│  │ GitHub  │    │   AST   │    │  Deps   │    │ Vectors │          │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘          │
│       │              │              │              │                 │
│       ▼              ▼              ▼              ▼                 │
│    repo/         CodeEntity[]   calls/calledBy  embeddings[]        │
│                                                                      │
│  ════════════════════════════════════════════════════════════════   │
│                                                                      │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐          │
│  │CLASSIFY │───▶│ SEARCH  │───▶│ EXPAND  │───▶│ SELECT  │          │
│  │  Query  │    │Semantic │    │  Graph  │    │ Budget  │          │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘          │
│       │              │              │              │                 │
│       ▼              ▼              ▼              ▼                 │
│   QueryType      matches[]    +dependencies    context string       │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Query Classification

Neocortex automatically detects your intent and adjusts the search strategy:

| Type | Example Query | Strategy |
|------|---------------|----------|
| **Simple** | "What does parseFile do?" | Direct match, depth=1 |
| **Multi-hop** | "What calls auth then writes to DB?" | Trace connections, depth=3 |
| **Architectural** | "How is the app structured?" | Boost entry points & types |
| **Debugging** | "Why might login fail?" | Include error handlers |
| **Usage** | "How do I use the API client?" | Find examples & imports |

---

## 🏗️ Project Structure

```
src/
├── index.ts              # CLI entry point (Commander.js)
├── server.ts             # Express API server
├── security.ts           # Rate limiting, audit logs, sanitization
│
├── clone.ts              # Git operations (clone, pull, file discovery)
├── parser.ts             # AST parsing with tree-sitter
├── graph.ts              # Dependency graph construction
├── embeddings.ts         # OpenAI/Voyage vector embeddings
│
├── retrieval/
│   ├── classifier.ts     # Query type detection
│   ├── search.ts         # Semantic + keyword + graph search
│   └── budget.ts         # Token budget selection
│
├── generator.ts          # Training data generation
├── templates.ts          # Q&A templates
├── output.ts             # JSONL file handling
├── types.ts              # TypeScript interfaces
│
└── ui/
    ├── App.tsx           # React application
    ├── CodeContextUI.tsx # Main UI component
    └── api.ts            # Frontend HTTP client
```

---

## 🔐 Security

Neocortex includes a comprehensive security layer:

- **Token Sanitization** — API keys are redacted from all error messages
- **Rate Limiting** — 30 requests/minute per user
- **Scope Validation** — Warns about excessive GitHub token permissions
- **Access Verification** — Checks repo access before cloning
- **Audit Logging** — All actions logged with timestamps
- **Session Timeout** — Auto-cleanup after 30min inactivity
- **Secure Cleanup** — Temp files deleted on logout

---

## 📊 Example Output

```
🎯 Context Retrieval Pipeline

┌─────────────────────────────────────────────────────────────┐
│ QUERY CLASSIFICATION                                        │
├─────────────────────────────────────────────────────────────┤
│ Type:       SIMPLE                                          │
│ Confidence: ████████░░  80%                                 │
│ Targets:    authentication                                  │
└─────────────────────────────────────────────────────────────┘

🔎 Searching: "how does authentication work"...
   Raw matches: 15
   Top scores: Login (0.325), onSignInButtonClick (0.296)

📊 SEARCH RESULTS — Found 5 entities, selected 5 within budget

  1. Login [keyword] - 765 tokens - src/pages/Login.tsx
  2. onSignInButtonClick [keyword] - 147 tokens - src/pages/Login.tsx
  3. PrivateRoute [graph] - 54 tokens - src/components/PrivateRoute.tsx
  4. getUser [keyword] - 36 tokens - src/utils/auth.ts
  5. AuthContext [semantic] - 89 tokens - src/contexts/AuthContext.tsx

Total tokens: 1,091 / 2,000 budget

═══════════════════════════════════════════════════════════════
CONTEXT (ready for LLM)
═══════════════════════════════════════════════════════════════

// File: src/pages/Login.tsx
function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  async function onSignInButtonClick() {
    const result = await signIn(email, password);
    if (result.success) {
      history.push('/dashboard');
    }
  }
  // ...
}

// File: src/components/PrivateRoute.tsx
function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
}
```

---

## ⚙️ Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | ✅ | OpenAI API key for embeddings |
| `GITHUB_TOKEN` | ❌ | For private repository access |
| `VOYAGE_API_KEY` | ❌ | Alternative: Voyage AI embeddings |
| `PORT` | ❌ | Server port (default: 3001) |

### Embedding Models

| Model | Provider | Use Case |
|-------|----------|----------|
| `openai` | OpenAI | General purpose, recommended |
| `voyage-code-2` | Voyage AI | Code-optimized embeddings |

---

## 📈 Performance

| Metric | Value |
|--------|-------|
| Parse speed | ~1,000 entities/sec |
| Embedding batch | 20 entities/request |
| Search latency | <500ms |
| Memory per repo | ~50MB (1,000 entities) |

---

## 🛠️ Development

```bash
# Install dependencies
pnpm install

# Run CLI in development
pnpm dev <command>

# Build for production
pnpm build

# Start production server
pnpm start
```

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🙏 Built With

- [tree-sitter](https://tree-sitter.github.io/) — Fast, incremental AST parsing
- [OpenAI](https://openai.com/) — Embedding models
- [Voyage AI](https://www.voyageai.com/) — Code-specific embeddings
- [Express](https://expressjs.com/) — API server
- [React](https://reactjs.org/) — Web UI
- [Vite](https://vitejs.dev/) — Frontend tooling
- [Tailwind CSS](https://tailwindcss.com/) — Styling

---

<p align="center">
  <strong>🧠 Neocortex</strong><br>
  <em>Intelligent Code Context Retrieval</em>
</p>
