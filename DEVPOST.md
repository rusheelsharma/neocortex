# Neocortex - Devpost Submission

## Inspiration

Modern AI coding assistants are powerful, but they struggle with unfamiliar codebases. They dump entire files into context or miss critical dependencies. We asked: **what if an AI could understand code the way a senior engineer does?** - by following function calls, understanding relationships, and retrieving only what's relevant. 

Neocortex was born from the frustration of watching LLMs hallucinate about code they couldn't see, while ignoring the exact functions that mattered. We wanted to build a tool that doesn't just *look* at code—it *understands* it.

---

## What it does

Neocortex is a **semantic code retrieval engine** that gives AI coding assistants laser-focused context. Point it at any GitHub repository, ask a natural language question like "how does authentication work?", and it returns the exact functions, classes, and types needed to answer—compressed to fit your token budget.

It works in three stages:
1. **Parse** – Uses Tree-sitter to extract every function, class, and type into a searchable dependency graph
2. **Search** – Combines OpenAI embeddings with keyword matching and graph traversal to find relevant code
3. **Compress** – Intelligently slices code to maximize relevance within your token budget (achieving **85%+ token reduction**)

The result: instead of 50,000 tokens of irrelevant code, you get 2,000 tokens of exactly what the AI needs.

**But here's where it gets interesting:** We built a full **MCP (Model Context Protocol) server** so any AI assistant—Claude, Cursor, or your custom agent—can use Neocortex as a tool. It's not just a CLI; it's an AI-native API.

### MCP Tools Available:
| Tool | Description |
|------|-------------|
| `index_repo` | Clone and index any GitHub repository |
| `search_code` | Semantic search with natural language queries |
| `resolve_symbol` | Find function/class definitions by name |
| `get_snippet` | Extract specific code from file:line references |
| `classify_query` | Analyze query intent to optimize search strategy |

---

## How we built it

We built a **pipeline architecture** in TypeScript (AND A LOT OF CAFFEINE 🤪☕):

1. **AST Parsing** with Tree-sitter extracts code entities and their relationships (what calls what)
2. **Dependency Graph** tracks bidirectional edges between functions—who calls whom
3. **Vector Embeddings** via OpenAI's text-embedding-3-small enable semantic search
4. **Query Classifier** analyzes intent to tune search strategy (simple lookup vs. multi-hop exploration)
5. **Compression Pipeline** uses query-aware slicing to preserve relevant lines while cutting tokens
6. **MCP Server** built with LeanMCP exposes everything as AI-callable tools

We chose Tree-sitter for parsing because it's battle-tested (powers GitHub's syntax highlighting) and gives us precise AST access. The hybrid search approach—combining embeddings with keyword boosting and graph expansion—outperforms pure semantic search on code.

The MCP integration means any AI that speaks the protocol can instantly gain code understanding superpowers. Claude can now `index_repo` your codebase and `search_code` without you copy-pasting a single line. *Chef's kiss.* 👨‍🍳

---

## Challenges we ran into

**Embedding score calibration** was brutal. OpenAI embeddings return scores in the 0.2-0.4 range for relevant code (not 0.8+ like you'd expect). We spent hours thinking our search was broken before realizing we needed to recalibrate thresholds. Turns out the AI wasn't broken—our expectations were.

**Graph explosion** – when you expand dependencies 2 levels deep, you can suddenly have hundreds of entities. We had to implement careful depth limiting and prioritization to keep results focused. It's like asking "who knows Bob?" and getting the entire LinkedIn network.

**Token budgets** – fitting meaningful code into 2,000 tokens while preserving context is an art. We built a slicing algorithm that keeps function signatures, relevant lines, and truncates intelligently. Every token counts when you're on a budget.

**MCP integration** – building an MCP server that plays nice with multiple AI clients required careful API design. We wanted `search_code` to return results that any LLM could immediately use, not just raw data dumps.

**SLEEP DEPRIVATION** – at 3 AM, every bug looks like a feature and every feature looks like a bug. We powered through on the holy trinity: caffeine, determination, and the occasional existential crisis about whether computers even *want* to understand code. ☕😵‍💫

---

## Accomplishments that we're proud of

- 🎯 **85%+ average token reduction** while preserving relevance—benchmarked across 4 repositories
- 🔍 **Hybrid search** that beats pure semantic search—combining embeddings, keywords, and graph relationships
- 🧠 **Query classification** that automatically adjusts search strategy based on question complexity
- 🔌 **Full MCP server** with 5 tools that any AI assistant can use out of the box
- ⚡ **Sub-second search** on repos with thousands of functions (246ms average latency)
- 💰 **93.8% cost savings** on LLM API calls by sending only relevant context
- 🚀 **Zero-config** – point it at any TypeScript/JavaScript repo and it just works
- 🤝 We divided our work really well and tackled core challenges as a team—it all integrated seamlessly

---

## What we learned

- Semantic similarity scores vary wildly between embedding models—always calibrate thresholds empirically
- Graph-based context expansion is crucial for code understanding—functions don't exist in isolation
- Token budgets force you to think carefully about information density (every character matters!)
- Tree-sitter is incredibly powerful for code analysis once you learn its query patterns
- MCP is the future of AI tool integration—building once and having it work everywhere is magical
- Taking a strategic "power nap" is really not the move and a huge gamble 🥲 (we learned this the hard way)
- The best debugging happens when you finally accept the bug was your fault all along

---

## What's next for Neocortex

- 🌍 **Multi-language support** – Python, Go, Rust, and more (Tree-sitter supports them all)
- 🔧 **IDE integration** – VS Code extension that provides context on-demand
- 💾 **Cached indexes** – persist embeddings and graphs for instant repeated queries
- 🎓 **Fine-tuned reranker** – train a model specifically for code relevance scoring
- 🔗 **MCP ecosystem** – publish to MCP registries so anyone can add Neocortex to their AI stack
- 📊 **Real-time analytics** – track what queries users ask most to improve retrieval

---

## Benchmark Highlights

| Metric | Value |
|--------|-------|
| **Average Token Reduction** | 85.2% |
| **Average Cost Savings** | 93.8% |
| **Search Latency** | 246ms |
| **Repositories Tested** | 4 |
| **Queries Executed** | 56 |

### Cost Savings at Scale (GPT-4o)
| Scale | Monthly Savings |
|-------|-----------------|
| 10,000 queries/month | **$808** |
| 100,000 queries/month | **$8,080** |

---

## Built With

- TypeScript
- Tree-sitter (AST parsing)
- OpenAI Embeddings (text-embedding-3-small)
- LeanMCP (MCP server framework)
- Node.js
- Express.js
- React + Vite (UI)
- Tailwind CSS
- A concerning amount of caffeine ☕

---

## Try It

```bash
# Clone and install
git clone https://github.com/rusheelsharma/neocortex
cd neocortex && pnpm install

# Run the demo
pnpm demo

# Or ask a question about any repo
pnpm dev context https://github.com/user/repo "how does X work?"

# Start the MCP server
pnpm mcp:dev
```

---

*Neocortex: Because your AI deserves better context than "here's the entire codebase, good luck."* 🧠✨
