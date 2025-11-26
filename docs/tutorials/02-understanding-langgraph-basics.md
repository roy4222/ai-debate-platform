# Tutorial: Understanding LangGraph Basics

**Target Audience:** Developers new to LangGraph
**Prerequisites:** Basic TypeScript/JavaScript knowledge
**Time to Complete:** 20-30 minutes
**Goal:** Build a simple 2-agent conversation to understand LangGraph core concepts

---

## What is LangGraph?

LangGraph is a framework for building **stateful, multi-agent applications** with LLMs. Unlike traditional chatbots that are linear chains of prompts, LangGraph uses **graphs** to model complex workflows where:

- Multiple agents interact
- Execution can loop or branch conditionally
- State is shared and managed automatically

### Why Use LangGraph?

**Traditional Approach (For-Loops):**
```typescript
// Hard to maintain, hard to extend
let messages = [];
for (let i = 0; i < 3; i++) {
  const response1 = await agent1(messages);
  messages.push(response1);
  const response2 = await agent2(messages);
  messages.push(response2);
}
```

**LangGraph Approach:**
```typescript
// Declarative, self-documenting
const workflow = new StateGraph()
  .addNode("agent1", agent1Node)
  .addNode("agent2", agent2Node)
  .addConditionalEdges("agent2", (state) =>
    state.round < 3 ? "agent1" : END
  );
```

**Key Advantage:** The second approach **shows the structure** of your workflow, not just the execution steps.

---

## Core Concepts

### 1. State (The Shared Blackboard)

All agents in a LangGraph workflow read and write to a shared **State** object.

```typescript
interface DebateState {
  messages: BaseMessage[];  // Conversation history
  round: number;            // Current round counter
  topic: string;            // Debate topic
}
```

**Mental Model:** Think of State as a **blackboard** in a classroom where all agents can read and write.

---

### 2. Nodes (The Agents)

A **Node** is a function that:
1. Receives the current state
2. Performs some action (like calling an LLM)
3. Returns updates to the state

**Node Signature:**
```typescript
type NodeFunction<S> = (state: S) => Promise<Partial<S>>;
```

**Example:**
```typescript
const optimistNode = async (state: DebateState): Promise<Partial<DebateState>> => {
  // 1. Read current state
  const context = state.messages;

  // 2. Call LLM
  const model = new ChatGroq({ apiKey: "...", model: "llama-3.1-8b-instant" });
  const response = await model.invoke([
    ...context,
    new HumanMessage("Provide a positive argument about: " + state.topic),
  ]);

  // 3. Return state updates
  return {
    messages: [response],  // Will be merged by reducer
  };
};
```

**Important:** Nodes return **partial state** — only the fields they want to update.

---

### 3. Edges (The Flow Control)

Edges define **how execution moves between nodes**.

#### Unconditional Edges
```typescript
workflow.addEdge("agent1", "agent2");
// After agent1 finishes, always go to agent2
```

#### Conditional Edges
```typescript
workflow.addConditionalEdges("agent2", (state) => {
  if (state.round < 3) return "agent1";  // Loop back
  return END;                             // Terminate
});
// After agent2, decide next node based on state
```

---

### 4. Reducers (How State Updates Merge)

When a node returns `{ messages: [newMessage] }`, how does it combine with existing `state.messages`?

**Answer:** Reducers define the merging strategy.

```typescript
const workflow = new StateGraph<DebateState>({
  channels: {
    messages: {
      reducer: (current, update) => current.concat(update),  // Append
      default: () => [],
    },
    round: {
      reducer: (_, update) => update,  // Overwrite
      default: () => 0,
    },
    topic: {
      reducer: (current, _) => current,  // Immutable (never changes)
      default: () => "",
    },
  },
});
```

**Common Reducer Patterns:**
- `concat()` — For arrays (append items)
- `(_, update) => update` — For counters (overwrite)
- `(current) => current` — For immutable fields

---

## Hands-On Example: Build a Simple Debate

Let's build a minimal 2-agent debate system step-by-step.

### Step 1: Install Dependencies

```bash
cd backend
npm install @langchain/langgraph @langchain/groq @langchain/core
```

### Step 2: Define State

```typescript
// src/types.ts
import { BaseMessage } from "@langchain/core/messages";

export interface SimpleDebateState {
  messages: BaseMessage[];
  round: number;
}
```

### Step 3: Create Agent Nodes

```typescript
// src/agents.ts
import { ChatGroq } from "@langchain/groq";
import { HumanMessage } from "@langchain/core/messages";
import { SimpleDebateState } from "./types";

const model = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY!,
  model: "llama-3.1-8b-instant",
  temperature: 0.7,
});

export const optimistNode = async (
  state: SimpleDebateState
): Promise<Partial<SimpleDebateState>> => {
  console.log(`[Round ${state.round}] Optimist is thinking...`);

  const response = await model.invoke([
    ...state.messages,
    new HumanMessage("Argue the positive side in 2 sentences."),
  ]);

  return {
    messages: [response],
  };
};

export const skepticNode = async (
  state: SimpleDebateState
): Promise<Partial<SimpleDebateState>> => {
  console.log(`[Round ${state.round}] Skeptic is thinking...`);

  const response = await model.invoke([
    ...state.messages,
    new HumanMessage("Challenge the previous argument in 2 sentences."),
  ]);

  return {
    messages: [response],
    round: state.round + 1,  // Increment round counter
  };
};
```

### Step 4: Build the Graph

```typescript
// src/graph.ts
import { StateGraph, END } from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { SimpleDebateState } from "./types";
import { optimistNode, skepticNode } from "./agents";

export function createSimpleDebateGraph() {
  // Define state channels
  const workflow = new StateGraph<SimpleDebateState>({
    channels: {
      messages: {
        reducer: (current, update) => current.concat(update),
        default: () => [],
      },
      round: {
        reducer: (_, update) => update,
        default: () => 0,
      },
    },
  });

  // Add agent nodes
  workflow.addNode("optimist", optimistNode);
  workflow.addNode("skeptic", skepticNode);

  // Define flow
  workflow.addEdge("optimist", "skeptic");  // Optimist → Skeptic
  workflow.addConditionalEdges("skeptic", (state) => {
    // Loop 3 times, then end
    if (state.round < 3) return "optimist";
    return END;
  });

  // Set starting point
  workflow.setEntryPoint("optimist");

  // Compile graph
  const checkpointer = new MemorySaver();
  return workflow.compile({ checkpointer });
}
```

### Step 5: Run the Debate

```typescript
// src/index.ts
import { HumanMessage } from "@langchain/core/messages";
import { createSimpleDebateGraph } from "./graph";

async function runDebate(topic: string) {
  const graph = createSimpleDebateGraph();

  const initialState = {
    messages: [new HumanMessage(`Debate topic: ${topic}`)],
    round: 0,
  };

  console.log(`🎭 Starting debate on: "${topic}"\n`);

  const result = await graph.invoke(initialState);

  console.log("\n📊 Debate Results:");
  console.log(`Total messages: ${result.messages.length}`);
  console.log(`Rounds completed: ${result.round}`);

  result.messages.forEach((msg, i) => {
    console.log(`\n[${i}] ${msg.constructor.name}:`);
    console.log(msg.content);
  });
}

// Run it!
runDebate("Should remote work become the default?");
```

### Step 6: Test It

```bash
cd backend
export GROQ_API_KEY="your-api-key"
npx tsx src/index.ts
```

**Expected Output:**
```
🎭 Starting debate on: "Should remote work become the default?"

[Round 0] Optimist is thinking...
[Round 0] Skeptic is thinking...
[Round 1] Optimist is thinking...
[Round 1] Skeptic is thinking...
[Round 2] Optimist is thinking...
[Round 2] Skeptic is thinking...

📊 Debate Results:
Total messages: 7
Rounds completed: 3

[0] HumanMessage:
Debate topic: Should remote work become the default?

[1] AIMessage:
Remote work increases productivity and employee satisfaction by eliminating commutes...

[2] AIMessage:
However, remote work can lead to isolation and reduced team collaboration...

[...]
```

---

## Key Takeaways

### 1. State is Shared
All nodes read and write to the same state object. This is how agents "communicate".

### 2. Nodes Return Partial Updates
You don't need to return the entire state — just the fields you want to change:
```typescript
return { round: state.round + 1 };  // Only update round
```

### 3. Reducers Control Merging
Define how updates combine with existing state:
- **Append:** `concat()` for arrays
- **Overwrite:** `(_, update) => update` for counters
- **Keep:** `(current) => current` for immutable fields

### 4. Conditional Edges Replace If-Else
Instead of:
```typescript
if (round < 3) continue;
else break;
```

Use:
```typescript
.addConditionalEdges("skeptic", (state) =>
  state.round < 3 ? "optimist" : END
);
```

### 5. Graphs are Self-Documenting
Looking at the graph definition tells you **what the workflow does**, not just **how it executes**.

---

## Common Patterns

### Pattern 1: Counter-Based Loops

```typescript
.addConditionalEdges("agent", (state) =>
  state.counter < MAX ? "agent" : END
);
```

**Use Case:** Run agent N times (like our debate rounds)

---

### Pattern 2: Flag-Based Routing

```typescript
.addConditionalEdges("checker", (state) => {
  if (state.hasError) return "fixer";
  if (state.needsReview) return "reviewer";
  return "finalizer";
});
```

**Use Case:** Branching logic based on agent outputs

---

### Pattern 3: Role-Based Routing

```typescript
.addConditionalEdges("classifier", (state) => {
  if (state.userQuery.includes("technical")) return "expert";
  if (state.userQuery.includes("simple")) return "beginner_agent";
  return "general_agent";
});
```

**Use Case:** Different agents for different query types

---

## Debugging Tips

### 1. Log State Changes

```typescript
const myNode = async (state: State) => {
  console.log("Before:", state);
  const update = { ... };
  console.log("Update:", update);
  return update;
};
```

### 2. Use `streamEvents()` for Detailed Traces

```typescript
const stream = await graph.streamEvents(initialState, { version: "v2" });

for await (const event of stream) {
  console.log(event);
  // Shows every node execution, LLM call, etc.
}
```

### 3. Test Nodes in Isolation

```typescript
// Unit test a single node
describe("Optimist Node", () => {
  it("should add positive argument", async () => {
    const result = await optimistNode({
      messages: [new HumanMessage("Topic: AI")],
      round: 0,
    });

    expect(result.messages).toHaveLength(1);
  });
});
```

---

## Next Steps

Now that you understand the basics:

1. **Add a Third Agent:** Create a `moderatorNode` that summarizes the debate
2. **Implement Streaming:** Use `graph.streamEvents()` to see token-by-token output
3. **Add Tools:** Give agents access to web search or database queries
4. **Explore Persistence:** Try using Cloudflare KV for checkpointing

---

## Additional Resources

- [LangGraph Conceptual Guide](https://langchain-ai.github.io/langgraphjs/concepts/)
- [LangGraph API Reference](https://langchain-ai.github.io/langgraphjs/reference/)
- [Our ADR-001: Why LangGraph](../adr/001-langgraph-for-agent-orchestration.md)
- [State Machine Diagram](../diagrams/03-langgraph-state-machine.mmd)

---

## Quick Reference Card

| Concept | Purpose | Example |
|---------|---------|---------|
| **State** | Shared data between agents | `{ messages: [], round: 0 }` |
| **Node** | Agent function | `async (state) => { return { ... } }` |
| **Edge** | Flow control | `.addEdge("a", "b")` |
| **Conditional Edge** | Branching logic | `.addConditionalEdges("a", (s) => ...)` |
| **Reducer** | State merge strategy | `(current, update) => current.concat(update)` |
| **Checkpointer** | State persistence | `new MemorySaver()` |
| **END** | Terminate execution | `return END;` |

---

**Congratulations!** You now understand the fundamentals of LangGraph. You're ready to build complex multi-agent systems!
