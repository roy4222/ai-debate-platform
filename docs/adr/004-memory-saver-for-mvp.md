# ADR-004: MemorySaver for MVP Checkpointing

**Status:** Accepted
**Date:** 2025-11-26
**Deciders:** Development Team
**Context:** LangGraph checkpointing strategy for state persistence

---

## Context

LangGraph requires a **checkpointer** to save execution state between node executions. This enables features like:
- Resuming interrupted workflows
- Time-travel debugging
- Human-in-the-loop interactions

### Checkpointer Options

LangGraph supports multiple checkpointer backends:

1. **MemorySaver** — In-memory JavaScript object storage
2. **Cloudflare KV** — Key-value store (requires binding)
3. **Cloudflare D1** — SQL database (requires schema setup)
4. **External databases** — PostgreSQL, Redis (incompatible with Workers)

---

## Our Use Case

**Debate Flow:**
```
User submits topic → Graph executes 3 rounds → Moderator summarizes → Done
```

**Key Characteristics:**
- **Single-session execution:** Debate runs start-to-finish in one API request (~10-15 seconds)
- **No pausing:** Users don't expect to pause mid-debate and resume later
- **No persistence needed:** Debate history is returned in final response, not stored

**Question:** Do we need persistent checkpointing?

---

## Decision

Use **MemorySaver** (in-memory checkpointing) for MVP scope.

---

## Rationale

### 1. Use Case Doesn't Require Persistence

**Persistent Checkpointing Use Cases:**
```typescript
// Example: Long-running workflow where user leaves and comes back
await graph.invoke(state, { thread_id: "user-123" });  // Saves to DB
// ... 1 hour later, different request ...
await graph.invoke(newInput, { thread_id: "user-123" });  // Resumes from DB
```

**Our Use Case:**
```typescript
// Single-shot execution within one HTTP request
const stream = await graph.streamEvents(state);
for await (const event of stream) {
  sendSSE(event);  // Stream to user in real-time
}
// Execution completes, no need to persist
```

**Conclusion:** We never need to resume from a saved checkpoint across requests.

---

### 2. MemorySaver Eliminates Infrastructure Complexity

**With Cloudflare KV:**
```toml
# wrangler.jsonc
{
  "kv_namespaces": [
    { "binding": "CHECKPOINTS", "id": "abc123..." }
  ]
}
```

```typescript
// Must implement custom checkpointer
class CloudflareKVSaver extends BaseCheckpointSaver {
  constructor(private kv: KVNamespace) { super(); }

  async getTuple(config) {
    const data = await this.kv.get(config.thread_id);
    return JSON.parse(data);
  }

  async putTuple(config, checkpoint) {
    await this.kv.put(config.thread_id, JSON.stringify(checkpoint));
  }

  // ... more methods ...
}
```

**With MemorySaver:**
```typescript
import { MemorySaver } from "@langchain/langgraph";

const checkpointer = new MemorySaver();  // One line!
const graph = workflow.compile({ checkpointer });
```

**Complexity Reduction:**
- No Wrangler configuration
- No custom checkpointer implementation
- No KV namespace creation
- No serialization/deserialization logic

**Time Saved:** ~2-4 hours of setup and debugging

---

### 3. Performance Benefits

**Read Latency:**
- **MemorySaver:** ~0.001ms (JavaScript object lookup)
- **KV:** ~50-200ms (network round-trip to KV store)

**Write Latency:**
- **MemorySaver:** ~0.001ms (in-memory write)
- **KV:** ~50-200ms (network write + eventual consistency delay)

**Impact on 3-Round Debate:**
- Checkpoints saved after each agent turn: 7 checkpoints
- **With KV:** 7 × 100ms = ~700ms overhead
- **With MemorySaver:** 7 × 0.001ms = negligible

**User Experience:** MemorySaver keeps debate latency under 10 seconds instead of 11+ seconds.

---

### 4. Memory Footprint is Negligible

**Checkpoint Size Estimation:**
```typescript
interface DebateState {
  messages: BaseMessage[];  // ~500 bytes per message × 7 messages = 3.5KB
  round: number;            // 8 bytes
  topic: string;            // ~100 bytes
}
// Total: ~4KB per checkpoint × 7 checkpoints = 28KB
```

**Cloudflare Workers Memory Limit:** 128MB
**Our Usage:** 28KB = 0.02% of available memory

**Conclusion:** Even with 100 concurrent debates, memory usage would be ~2.8MB (2% of limit).

---

## Consequences

### Positive

✅ **Zero configuration** — no infrastructure setup
✅ **Fast execution** — no network I/O overhead
✅ **Simple testing** — no need to mock KV in tests
✅ **Faster development** — focus on agent logic, not persistence

### Negative

⚠️ **No cross-request persistence** — state is lost when Worker shuts down
⚠️ **Can't implement "resume debate" feature** — would require refactoring to KV
⚠️ **No debugging historical runs** — can't replay past debates

### Acceptable Trade-Offs

**Why These Limitations are OK for MVP:**

1. **No Resume Feature Needed:**
   - Users watch debate in real-time (10-15 seconds)
   - No use case for pausing and coming back later
   - If added in v2.0, can migrate to KV then

2. **No Historical Debugging Needed:**
   - Debate results are returned in API response
   - Frontend can log full conversation to localStorage if desired
   - Production monitoring can use `streamEvents()` logs

3. **Workers Auto-Scale:**
   - Each request gets its own Worker instance
   - State is isolated per request by default
   - MemorySaver fits this model perfectly

---

## Future Migration Path (v2.0)

**If** we later need persistent checkpointing (e.g., for "Save and resume debate" feature):

### Step 1: Implement Cloudflare KV Checkpointer
```typescript
// src/kv-checkpointer.ts
import { BaseCheckpointSaver } from "@langchain/langgraph";

export class KVCheckpointer extends BaseCheckpointSaver {
  constructor(private kv: KVNamespace) { super(); }

  async getTuple(config: RunnableConfig) {
    const key = `checkpoint:${config.configurable?.thread_id}`;
    const data = await this.kv.get(key, "json");
    return data;
  }

  async putTuple(config: RunnableConfig, checkpoint: Checkpoint) {
    const key = `checkpoint:${config.configurable?.thread_id}`;
    await this.kv.put(key, JSON.stringify(checkpoint), { expirationTtl: 86400 }); // 24h TTL
  }
}
```

### Step 2: Update Graph Compilation
```typescript
// Before
const checkpointer = new MemorySaver();

// After
const checkpointer = new KVCheckpointer(env.CHECKPOINTS);
```

### Step 3: Update API to Support Thread IDs
```typescript
// POST /api/debate
{
  "topic": "...",
  "thread_id": "debate-abc123"  // Optional: for resume functionality
}
```

**Migration Effort:** ~4-6 hours
**Breaking Changes:** None (MemorySaver API is compatible with KV checkpointer)

---

## Testing Strategy

**With MemorySaver:**
```typescript
// backend/test/graph.spec.ts
describe("Debate Graph", () => {
  it("should maintain state across nodes", async () => {
    const checkpointer = new MemorySaver();
    const graph = workflow.compile({ checkpointer });

    const result = await graph.invoke({ messages: [...], round: 0 });

    // Checkpointer stored intermediate states
    expect(result.round).toBe(3);
    expect(result.messages).toHaveLength(7);
  });
});
```

**No need to:**
- Mock KV namespace
- Set up test databases
- Handle async persistence delays

---

## Alternative: No Checkpointing

**Could we skip checkpointing entirely?**

**Answer:** No, LangGraph requires a checkpointer even for single-session executions.

**Why?**
- Checkpointer is how LangGraph tracks state between nodes
- Without it, nodes can't access previous state
- Even if not persisting to disk, MemorySaver provides the interface

**Code Example:**
```typescript
// This will throw an error:
const graph = workflow.compile();  // ❌ Missing checkpointer

// This is minimum viable:
const graph = workflow.compile({ checkpointer: new MemorySaver() });  // ✅
```

---

## Comparison Table

| Feature | MemorySaver | KV Checkpointer | D1 Checkpointer |
|---------|------------|----------------|----------------|
| **Setup Time** | 0 minutes | ~1-2 hours | ~2-4 hours |
| **Read Latency** | <1ms | 50-200ms | 50-200ms |
| **Write Latency** | <1ms | 50-200ms | 100-300ms |
| **Persists Across Requests** | ❌ | ✅ | ✅ |
| **Cost** | Free | Free (1GB limit) | Free (500MB limit) |
| **Code Complexity** | Low | Medium | High |
| **Suitable for MVP** | ✅ | ⚠️ Overkill | ⚠️ Overkill |

**Decision:** MemorySaver is the pragmatic choice for our MVP scope.

---

## References

- [LangGraph Checkpointing Documentation](https://langchain-ai.github.io/langgraphjs/concepts/persistence/)
- [MemorySaver API](https://langchain-ai.github.io/langgraphjs/reference/classes/index.MemorySaver.html)
- [Cloudflare KV Documentation](https://developers.cloudflare.com/kv/)
- [Cloudflare Workers Memory Limits](https://developers.cloudflare.com/workers/platform/limits/)

---

## Revision History

| Date       | Version | Changes                                      |
|------------|---------|----------------------------------------------|
| 2025-11-26 | 1.0     | Decision to use MemorySaver for MVP          |
