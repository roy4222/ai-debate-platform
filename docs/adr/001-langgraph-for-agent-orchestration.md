# ADR-001: LangGraph for Agent Orchestration

**Status:** Accepted
**Date:** 2025-11-26
**Deciders:** Development Team
**Technical Story:** Multi-Agent Debate System Implementation

---

## Context

We need to build a **multi-agent AI debate platform** where different agent personas (Optimist, Skeptic, Moderator) interact in a structured conversation flow. The system requirements include:

1. **Complex Flow Control:**
   - Agents must take turns speaking in a specific order
   - The debate should loop for a configurable number of rounds (e.g., 3 rounds)
   - Conditional logic determines when to transition between agents or end the debate

2. **State Management:**
   - All agents need access to the full conversation history
   - Round counter and debate topic must be shared across agents
   - State updates from one agent must be visible to subsequent agents

3. **Extensibility:**
   - New agent roles should be easy to add (e.g., Fact Checker, Expert)
   - Flow logic should be modifiable without rewriting core orchestration code

4. **Resume Goal:**
   - This project is intended for job applications to demonstrate **high-level AI engineering capabilities**
   - The architecture should showcase advanced patterns that differentiate it from simple loop-based implementations

### Architectural Choices Considered

**Option 1: Hand-Written Imperative Loops**
```typescript
// Simple but rigid approach
for (let round = 0; round < 3; round++) {
  const optimistResponse = await callOptimist(messages);
  messages.push(optimistResponse);

  const skepticResponse = await callSkeptic(messages);
  messages.push(skepticResponse);
}
const summary = await callModerator(messages);
```

**Option 2: Event-Driven Actor System**
- Use message queues (e.g., BullMQ, RabbitMQ)
- Each agent is an independent worker
- Requires external infrastructure (Redis, message broker)

**Option 3: LangGraph StateGraph**
```typescript
// Declarative graph-based approach
const workflow = new StateGraph<DebateState>()
  .addNode("optimist", optimistNode)
  .addNode("skeptic", skepticNode)
  .addNode("moderator", moderatorNode)
  .addConditionalEdges("skeptic", (state) =>
    state.round < 3 ? "optimist" : "moderator"
  )
  .setEntryPoint("optimist");
```

---

## Decision

We will use **LangGraph.js** with a **StateGraph** architecture to orchestrate agent interactions.

---

## Rationale

### 1. Declarative Flow Definition

**LangGraph Advantage:**
- Workflow is defined as a **directed graph** where nodes represent agents and edges represent transitions
- The structure is **self-documenting** — you can visualize the exact flow by looking at the graph definition
- Changes to flow logic require only modifying edges, not rewriting control flow statements

**Example:**
```typescript
// Adding a new "Fact Checker" agent between rounds is trivial:
workflow.addNode("fact_checker", factCheckerNode);
workflow.addConditionalEdges("optimist", (state) => {
  if (state.round === 2) return "fact_checker";  // Insert fact check at round 2
  return "skeptic";
});
```

In a hand-written loop, this would require complex nested `if` statements and tracking additional state flags.

---

### 2. Built-In State Management

**LangGraph Advantage:**
- Uses a **Reducer Pattern** to automatically merge state updates from each node
- Developers define how state fields combine (e.g., `messages` array concatenates, `round` counter overwrites)
- Eliminates manual state passing between functions

**State Definition Example:**
```typescript
const graph = new StateGraph<DebateState>({
  channels: {
    messages: {
      reducer: (current, update) => current.concat(update),  // Auto-append messages
      default: () => [],
    },
    round: {
      reducer: (_, update) => update,  // Overwrite round counter
      default: () => 0,
    },
  },
});
```

**Without LangGraph:**
```typescript
// Manual state threading — error-prone
let state = { messages: [], round: 0 };
state = await optimistNode(state);
state = await skepticNode(state);
// Easy to forget to pass updated state correctly
```

---

### 3. Conditional Routing (Conditional Edges)

**LangGraph Advantage:**
- Supports **dynamic routing** based on state values
- Replaces complex `if-else` chains with declarative edge functions
- Makes it easy to implement patterns like:
  - Loop until condition met (`round < 3`)
  - Early termination (`shouldStop` flag)
  - Dynamic branching (`role === "expert" ? expertNode : moderatorNode`)

**Conditional Edge Example:**
```typescript
workflow.addConditionalEdges("skeptic", (state: DebateState) => {
  if (state.shouldStop) return "moderator";      // Emergency stop
  if (state.round < 3) return "optimist";        // Continue debate
  return "moderator";                            // Normal conclusion
});
```

**Hand-Written Equivalent:**
```typescript
// Nested if-else becomes unreadable with multiple conditions
while (true) {
  // ... skeptic logic ...
  if (state.shouldStop) {
    await callModerator(state);
    break;
  }
  if (state.round >= 3) {
    await callModerator(state);
    break;
  }
  await callOptimist(state);
}
```

---

### 4. Event Streaming for Real-Time Monitoring

**LangGraph Advantage:**
- Built-in `streamEvents()` API provides detailed execution traces
- Can track:
  - When each node starts/ends (`on_chain_start`, `on_chain_end`)
  - LLM token streaming (`on_chat_model_stream`)
  - Tool calls (if using LangChain tools)
- Essential for building **real-time UI** where users watch agents "thinking"

**Streaming Example:**
```typescript
const stream = await graph.streamEvents(initialState, { version: "v2" });

for await (const event of stream) {
  if (event.event === "on_chain_start" && event.name === "optimist") {
    console.log("Optimist is now speaking...");
  }
  if (event.event === "on_chat_model_stream") {
    // Stream tokens to frontend via SSE
    sendSSE({ type: "token", content: event.data.chunk.content });
  }
}
```

**Hand-Written Equivalent:**
```typescript
// Must manually emit events at every step
emitEvent({ type: "agent_start", agent: "optimist" });
const response = await llm.stream(prompt);
for await (const chunk of response) {
  emitEvent({ type: "token", content: chunk });
}
emitEvent({ type: "agent_end", agent: "optimist" });
// Easy to miss events or emit inconsistent formats
```

---

### 5. Future-Proof Architecture

**LangGraph Advantage:**
- Designed for advanced AI agent patterns:
  - **Human-in-the-loop:** Pause execution and wait for user input
  - **Tool calling:** Agents can invoke external APIs (web search, databases)
  - **Subgraphs:** Nest smaller workflows inside larger ones
- Our MVP uses a subset of features, but the architecture supports growth

**Future Extensions Without Refactoring:**
```typescript
// Add web search tool to agents
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
const tools = [new TavilySearchResults()];

// Bind tools to LLM
const modelWithTools = model.bindTools(tools);

// LangGraph automatically handles tool invocation and result injection
```

---

### 6. Resume/Portfolio Value

**Why This Matters for Job Applications:**

| Hand-Written Loops | LangGraph StateGraph |
|-------------------|---------------------|
| "Implemented a chatbot with multiple prompts" | "Architected a cyclic multi-agent workflow using LangGraph state machines" |
| Shows basic API integration | Demonstrates understanding of: <br>- Graph theory in AI systems <br>- State management patterns <br>- Declarative programming <br>- Production-ready AI orchestration |
| ⭐⭐ | ⭐⭐⭐⭐⭐ |

**Interview Talking Points:**
- "I chose LangGraph over hand-written loops because it provides built-in observability, which was critical for debugging complex agent interactions."
- "The conditional edge pattern allowed me to implement dynamic debate rules without spaghetti code."
- "Using a StateGraph made it trivial to add a new Fact Checker agent — just one `addNode()` call."

---

## Consequences

### Positive

✅ **Maintainability:** New agents and flow changes are localized to graph definition
✅ **Debuggability:** `streamEvents()` provides comprehensive execution logs
✅ **Scalability:** Can easily extend to 5+ agents without code complexity explosion
✅ **Professionalism:** Architecture demonstrates senior-level engineering thinking
✅ **Reusability:** StateGraph pattern can be applied to future AI projects

### Negative

⚠️ **Learning Curve:** LangGraph concepts (reducers, checkpointers, conditional edges) require initial study time (~4-8 hours)
⚠️ **Bundle Size:** Adds ~150KB to Workers bundle (LangChain Core + LangGraph)
⚠️ **Debugging Complexity:** Graph execution is harder to step through than linear code
⚠️ **Documentation Gaps:** LangGraph.js docs are less mature than Python version

### Neutral

🔄 **Dependency on LangChain Ecosystem:** Committed to LangChain's abstractions (e.g., `BaseMessage`, `Runnable`)
🔄 **Cloudflare Workers Compatibility:** Must use `MemorySaver` instead of database checkpointers (acceptable for MVP scope)

---

## Alternatives Considered and Rejected

### Why Not Hand-Written Loops?

**Rejected because:**
- Does not demonstrate advanced engineering skills on resume
- Becomes unmaintainable with >3 agents or complex branching logic
- No built-in observability — must manually instrument every step
- Difficult to unit test individual agent behaviors in isolation

**When to use:** Simple sequential workflows with no conditional branching (e.g., single-turn Q&A)

---

### Why Not Event-Driven Actor System?

**Rejected because:**
- Requires external infrastructure (Redis, RabbitMQ) which conflicts with Cloudflare Workers' serverless model
- Overkill for synchronous debate flow (agents don't need to run in parallel)
- Adds operational complexity (message broker management, retry logic, dead letter queues)

**When to use:** Truly asynchronous multi-agent systems where agents operate independently (e.g., swarm robotics, distributed simulations)

---

## Implementation Notes

### Minimal Working Example

```typescript
// src/graph.ts
import { StateGraph, END } from "@langchain/langgraph";
import { ChatGroq } from "@langchain/groq";
import { HumanMessage, BaseMessage } from "@langchain/core/messages";

interface DebateState {
  messages: BaseMessage[];
  round: number;
}

export const createDebateGraph = (groqApiKey: string) => {
  const model = new ChatGroq({ apiKey: groqApiKey, model: "llama-3.1-8b-instant" });

  const optimistNode = async (state: DebateState) => {
    const response = await model.invoke([
      ...state.messages,
      new HumanMessage("Argue the positive side in 2-3 sentences."),
    ]);
    return { messages: [response], round: state.round };
  };

  const skepticNode = async (state: DebateState) => {
    const response = await model.invoke([
      ...state.messages,
      new HumanMessage("Challenge the previous argument in 2-3 sentences."),
    ]);
    return { messages: [response], round: state.round + 1 };
  };

  const workflow = new StateGraph<DebateState>({
    channels: {
      messages: { reducer: (a, b) => a.concat(b), default: () => [] },
      round: { reducer: (_, b) => b, default: () => 0 },
    },
  })
    .addNode("optimist", optimistNode)
    .addNode("skeptic", skepticNode)
    .addEdge("optimist", "skeptic")
    .addConditionalEdges("skeptic", (state) => (state.round < 3 ? "optimist" : END))
    .setEntryPoint("optimist");

  return workflow.compile();
};
```

### Testing Strategy

```typescript
// backend/test/graph.spec.ts
import { describe, it, expect } from "vitest";
import { createDebateGraph } from "../src/graph";
import { HumanMessage } from "@langchain/core/messages";

describe("Debate Graph", () => {
  it("should execute 3 rounds of debate", async () => {
    const graph = createDebateGraph(process.env.GROQ_API_KEY!);

    const result = await graph.invoke({
      messages: [new HumanMessage("Should AI replace human artists?")],
      round: 0,
    });

    // Expect 1 initial message + 6 agent messages (3 rounds × 2 agents)
    expect(result.messages).toHaveLength(7);
    expect(result.round).toBe(3);
  });
});
```

---

## References

- [LangGraph Conceptual Guide](https://langchain-ai.github.io/langgraphjs/concepts/)
- [LangGraph Quick Start](https://langchain-ai.github.io/langgraphjs/tutorials/quickstart/)
- [StateGraph API Reference](https://langchain-ai.github.io/langgraphjs/reference/classes/index.StateGraph.html)
- [Martin Fowler: Patterns of Enterprise Application Architecture](https://martinfowler.com/eaaCatalog/) (State Machine pattern)

---

## Revision History

| Date       | Version | Changes                                      |
|------------|---------|----------------------------------------------|
| 2025-11-26 | 1.0     | Initial decision to use LangGraph StateGraph |
