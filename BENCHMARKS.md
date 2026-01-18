# 🧠 Neocortex Benchmark Results

> **Semantic Compression for Code Context**  
> Benchmark run: 1/18/2026, 11:08:54 AM

---

## 📊 Key Metrics

| Metric | Value |
|--------|-------|
| **Average Token Reduction** | **85.2%** |
| **Average Search Latency** | 246ms |
| **Repositories Tested** | 4 |
| **Queries Executed** | 56 |

---

## 📉 Compression by Token Budget

| Budget | Token Reduction | Compression Ratio |
|--------|-----------------|-------------------|
| 500 tokens | **93.9%** | 0.939x |
| 1000 tokens | **87.0%** | 0.870x |
| 2000 tokens | **74.5%** | 0.745x |
| 4000 tokens | **86.1%** | 0.861x |

---

## 🎯 Performance by Query Type

| Query Type | Token Reduction | Queries Tested |
|------------|-----------------|----------------|
| simple | **84.6%** | 24 |
| architectural | **79.6%** | 20 |
| debugging | **95.6%** | 4 |
| multi-hop | **95.5%** | 8 |

---

## 💰 Cost Savings Analysis

Based on average codebase size and 2000 token budget:

### Per Query
| Model | Before | After | Savings |
|-------|--------|-------|---------|
| GPT-4o-mini | $0.00129 | $0.00008 | **93.8%** |
| GPT-4o | $0.08616 | $0.00532 | **93.8%** |

### At Scale (10,000 queries/month)
| Model | Monthly Savings |
|-------|-----------------|
| GPT-4o-mini | **$12.13** |
| GPT-4o | **$808.41** |

---

## 📁 Repository Details


### sindresorhus/is

| Metric | Value |
|--------|-------|
| Files | 4 |
| Entities | 15 |
| Total Tokens | 368 |
| Parse Time | 9ms |
| Embed Time | 833ms |
| Avg Reduction | **84.7%** |
| Avg Latency | 235ms |


### progressiveoverload

| Metric | Value |
|--------|-------|
| Files | 23 |
| Entities | 83 |
| Total Tokens | 17,472 |
| Parse Time | 81ms |
| Embed Time | 2548ms |
| Avg Reduction | **94.2%** |
| Avg Latency | 241ms |


### personal-portfolio

| Metric | Value |
|--------|-------|
| Files | 10 |
| Entities | 6 |
| Total Tokens | 2,332 |
| Parse Time | 11ms |
| Embed Time | 370ms |
| Avg Reduction | **60.5%** |
| Avg Latency | 266ms |


### Memora

| Metric | Value |
|--------|-------|
| Files | 15 |
| Entities | 70 |
| Total Tokens | 14,293 |
| Parse Time | 72ms |
| Embed Time | 2910ms |
| Avg Reduction | **95.1%** |
| Avg Latency | 245ms |


---

## 🔬 Methodology

1. **Clone** - Repository cloned to local temp directory
2. **Parse** - AST extraction using tree-sitter for all .ts/.tsx/.js/.jsx files
3. **Index** - Build dependency graph and generate OpenAI embeddings
4. **Query** - Run benchmark queries at multiple token budgets
5. **Measure** - Record token counts, compression ratios, and latencies

### Test Queries

**sindresorhus/is:**
- "what types are exported" (simple)
- "how does type checking work" (architectural)
- "what is the isString function" (simple)
- "what types are exported" (simple)
- "how does type checking work" (architectural)
- "what is the isString function" (simple)
- "what types are exported" (simple)
- "how does type checking work" (architectural)
- "what is the isString function" (simple)
- "what types are exported" (simple)
- "how does type checking work" (architectural)
- "what is the isString function" (simple)


**progressiveoverload:**
- "how does authentication work" (architectural)
- "what variables store user data" (simple)
- "how are exercises tracked" (multi-hop)
- "what happens when login fails" (debugging)
- "how does authentication work" (architectural)
- "what variables store user data" (simple)
- "how are exercises tracked" (multi-hop)
- "what happens when login fails" (debugging)
- "how does authentication work" (architectural)
- "what variables store user data" (simple)
- "how are exercises tracked" (multi-hop)
- "what happens when login fails" (debugging)
- "how does authentication work" (architectural)
- "what variables store user data" (simple)
- "how are exercises tracked" (multi-hop)
- "what happens when login fails" (debugging)


**personal-portfolio:**
- "what components are there" (simple)
- "how is navigation implemented" (architectural)
- "what is the Projects component" (simple)
- "what components are there" (simple)
- "how is navigation implemented" (architectural)
- "what is the Projects component" (simple)
- "what components are there" (simple)
- "how is navigation implemented" (architectural)
- "what is the Projects component" (simple)
- "what components are there" (simple)
- "how is navigation implemented" (architectural)
- "what is the Projects component" (simple)


**Memora:**
- "how does the family tree work" (architectural)
- "what happens when adding a memory" (multi-hop)
- "how is data stored" (architectural)
- "what components render the UI" (simple)
- "how does the family tree work" (architectural)
- "what happens when adding a memory" (multi-hop)
- "how is data stored" (architectural)
- "what components render the UI" (simple)
- "how does the family tree work" (architectural)
- "what happens when adding a memory" (multi-hop)
- "how is data stored" (architectural)
- "what components render the UI" (simple)
- "how does the family tree work" (architectural)
- "what happens when adding a memory" (multi-hop)
- "how is data stored" (architectural)
- "what components render the UI" (simple)


---

## 🏆 Summary

Neocortex achieves **85% average token reduction** through semantic compression:

- **Content-aware selection**: Only relevant code entities are included
- **Dependency expansion**: Related functions discovered via call graph
- **Smart slicing**: Long functions compressed while preserving key sections
- **Query optimization**: Search strategy adapted to query type

This enables fitting **6.8x more context** into the same LLM token window, or achieving **85% cost savings** per query.

---

*Generated by Neocortex Benchmark Suite*
