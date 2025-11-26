# ADR-002: State Graph vs Hand-Written Loops

**Status:** Accepted
**Date:** 2025-11-26
**Deciders:** Development Team
**Supersedes:** Initial prototype with imperative loops

---

## Context

During the initial planning phase, we evaluated two fundamentally different approaches to implementing the agent orchestration logic:

1. **Imperative Approach:** Traditional for-loops with explicit control flow
2. **Declarative Approach:** LangGraph StateGraph with node-based execution

This ADR provides a detailed comparison to justify our architectural choice and serve as a reference for future projects with similar requirements.

---

## Comparison Matrix

### Code Complexity

| Scenario | Hand-Written Loops | LangGraph StateGraph |
|----------|-------------------|---------------------|
| **Simple 3-round debate** | 15-20 lines | 25-30 lines (due to setup) |
| **Add conditional fact-checking** | +10-15 lines of nested if-else | +3 lines (one conditional edge) |
| **Add 2 more agent roles** | Refactor entire loop structure | +2 `addNode()` calls |
| **Implement early termination** | Insert `break` statements, track flags | +1 conditional edge case |
| **Dynamic round count** | Replace constant with variable | No changes needed |
| **Total LOC for 5-agent system** | ~80-120 lines | ~40-60 lines |

**Winner:** StateGraph (better scalability)

---

### Readability

#### Hand-Written Example
```typescript
async function runDebate(topic: string, rounds: number) {
  const messages = [{ role: "user", content: topic }];
  let round = 0;

  while (round < rounds) {
    // Optimist turn
    const optPrompt = [...messages, { role: "system", content: "Argue positively" }];
    const optResp = await llm.generate(optPrompt);
    messages.push({ role: "assistant", content: optResp });

    // Fact check on round 2
    if (round === 2) {
      const factPrompt = [...messages, { role: "system", content: "Verify facts" }];
      const factResp = await llm.generate(factPrompt);
      messages.push({ role: "assistant", content: factResp });
      if (factResp.includes("ERROR")) {
        // Re-run optimist? Adjust round? Unclear...
        break;
      }
    }

    // Skeptic turn
    const skepPrompt = [...messages, { role: "system", content: "Challenge critically" }];
    const skepResp = await llm.generate(skepPrompt);
    messages.push({ role: "assistant", content: skepResp });

    // Should moderator intervene?
    if (detectToxicity(skepResp)) {
      const modResp = await llm.generate([...messages, { role: "system", content: "Moderate" }]);
      messages.push({ role: "assistant", content: modResp });
      break;
    }

    round++;
  }

  // Final summary
  const summary = await llm.generate([...messages, { role: "system", content: "Summarize" }]);
  return { messages, summary };
}
```

**Problems:**
- Flow is **opaque** — must read entire function to understand agent order
- Conditional logic (**round === 2**, **toxicity check**) is **scattered** throughout code
- **Unclear intent:** Why does fact check break the loop? What happens to the round counter?

---

#### StateGraph Example
```typescript
const workflow = new StateGraph<DebateState>({
  channels: {
    messages: { reducer: (a, b) => a.concat(b), default: () => [] },
    round: { reducer: (_, b) => b, default: () => 0 },
    hasFactError: { reducer: (_, b) => b, default: () => false },
  },
})
  .addNode("optimist", optimistNode)
  .addNode("fact_checker", factCheckerNode)
  .addNode("skeptic", skepticNode)
  .addNode("moderator", moderatorNode)

  // Flow is self-documenting
  .addConditionalEdges("optimist", (state) => {
    if (state.round === 2) return "fact_checker";
    return "skeptic";
  })
  .addConditionalEdges("fact_checker", (state) => {
    if (state.hasFactError) return END;  // Explicit termination
    return "skeptic";
  })
  .addConditionalEdges("skeptic", (state) => {
    if (detectToxicity(state.messages)) return "moderator";
    if (state.round < 3) return "optimist";
    return "moderator";
  })
  .setEntryPoint("optimist");
```

**Advantages:**
- Flow is **explicit** — agent order is clear from edge definitions
- Conditional logic is **localized** to edge functions
- **Self-documenting:** Edge names describe the decision points ("fact_checker on round 2")

**Winner:** StateGraph (intent is clearer)

---

### State Management

#### Hand-Written Approach
```typescript
// Must manually thread state through every step
let state = { messages: [], round: 0, hasFactError: false };

// Easy to make mistakes
const optResult = await optimistNode(state);
state.messages.push(optResult.message);  // Manual append
// Oops, forgot to update round counter!

const skepResult = await skepticNode(state);
state.messages = state.messages.concat(skepResult.message);  // Inconsistent update style
state.round = skepResult.round;
```

**Problems:**
- **No enforcement:** Developers must remember to update state correctly
- **Inconsistent patterns:** Some code uses `.push()`, others use `.concat()`
- **Debugging nightmare:** Tracking which function mutated state incorrectly

---

#### StateGraph Approach
```typescript
// State updates are enforced by reducers
const optimistNode = async (state: DebateState) => {
  const response = await model.invoke(...);
  return {
    messages: [response],  // Reducer automatically concatenates
    // No need to return round — unchanged fields are preserved
  };
};

const skepticNode = async (state: DebateState) => {
  const response = await model.invoke(...);
  return {
    messages: [response],
    round: state.round + 1,  // Reducer overwrites with new value
  };
};
```

**Advantages:**
- **Type-safe:** TypeScript enforces partial state returns
- **Consistent:** All updates go through reducers
- **Predictable:** Each field has a defined merge strategy (concat, overwrite, etc.)

**Winner:** StateGraph (eliminates entire class of bugs)

---

### Observability

#### Hand-Written Approach
```typescript
// Must manually instrument every step
console.log(`[${new Date().toISOString()}] Starting Optimist`);
const optResp = await callOptimist(state);
console.log(`[${new Date().toISOString()}] Optimist completed: ${optResp.length} chars`);

// Forgot to log Skeptic start...
const skepResp = await callSkeptic(state);
console.log(`[${new Date().toISOString()}] Skeptic completed`);

// Inconsistent log formats, easy to miss events
```

---

#### StateGraph Approach
```typescript
const stream = await graph.streamEvents(initialState, { version: "v2" });

for await (const event of stream) {
  // Automatically logs every node execution
  console.log(event);
  /*
  {
    event: "on_chain_start",
    name: "optimist",
    run_id: "a1b2c3...",
    timestamp: "2025-11-26T10:30:00.000Z"
  }
  {
    event: "on_chat_model_stream",
    data: { chunk: { content: "I believe..." } },
    timestamp: "2025-11-26T10:30:01.234Z"
  }
  {
    event: "on_chain_end",
    name: "optimist",
    timestamp: "2025-11-26T10:30:05.000Z"
  }
  */
}
```

**Advantages:**
- **Comprehensive:** Captures every node, LLM call, and tool invocation
- **Consistent:** Standardized event format
- **No manual instrumentation:** Can't forget to add logs

**Winner:** StateGraph (production-grade observability out of the box)

---

### Testing

#### Hand-Written Approach
```typescript
// Must test the entire flow end-to-end
describe("Debate Flow", () => {
  it("should complete 3 rounds", async () => {
    const result = await runDebate("Should AI be regulated?", 3);
    expect(result.messages).toHaveLength(7);  // Brittle: assumes no fact checks
  });
});
```

**Problems:**
- **Integration tests only:** Hard to test individual agent behaviors
- **Brittle:** Adding a fact check breaks existing tests
- **Slow:** Must run entire flow for every test case

---

#### StateGraph Approach
```typescript
// Can test nodes in isolation
describe("Optimist Node", () => {
  it("should add positive argument", async () => {
    const result = await optimistNode({
      messages: [new HumanMessage("Topic: AI regulation")],
      round: 0,
    });

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].content).toContain("benefit");
  });
});

// Test conditional logic separately
describe("Debate Graph Routing", () => {
  it("should insert fact checker on round 2", () => {
    const nextNode = getNextNode({ round: 2 });  // Mock conditional edge
    expect(nextNode).toBe("fact_checker");
  });
});
```

**Advantages:**
- **Unit testable:** Each node is a pure function
- **Fast:** No need to run LLM for routing tests
- **Resilient:** Changing flow doesn't break node tests

**Winner:** StateGraph (better testability)

---

### Extensibility

#### Scenario: Add "Human-in-the-Loop" Approval

**Requirement:** After Moderator generates summary, wait for user approval before finalizing.

---

**Hand-Written Approach:**
```typescript
// Must refactor function to be async generator or use callbacks
async function runDebateWithApproval(topic: string, rounds: number) {
  // ... existing debate logic ...

  const summary = await callModerator(messages);

  // Now need to expose this to external code somehow
  return {
    status: "pending_approval",
    summary,
    resumeFunction: async (approved: boolean) => {
      if (approved) {
        return { status: "completed", summary };
      } else {
        // Re-run moderator? Resume from where?
        // State is lost — must refactor entire function!
      }
    }
  };
}
```

**Problems:**
- Requires **complete refactoring** to support pause/resume
- State persistence is **manual**
- Resumption logic is **ad-hoc**

---

**StateGraph Approach:**
```typescript
// Add a special node that waits for input
const approvalNode = async (state: DebateState): Promise<Partial<DebateState>> => {
  // This node marks execution as "interrupted"
  return { status: "awaiting_approval" };
};

workflow
  .addNode("approval", approvalNode)
  .addEdge("moderator", "approval")
  .addConditionalEdges("approval", (state) => {
    if (state.userApproved) return "finalize";
    return "moderator";  // Regenerate summary
  });

// Usage:
const checkpointer = new MemorySaver();
const graph = workflow.compile({ checkpointer });

// Initial run
const thread = { configurable: { thread_id: "debate-123" } };
await graph.invoke(initialState, thread);  // Pauses at approval node

// Later, resume with approval
await graph.invoke({ userApproved: true }, thread);  // Continues from checkpoint
```

**Advantages:**
- **No refactoring:** Just add a node
- **State preserved:** Checkpointer handles persistence
- **Standard pattern:** Human-in-the-loop is built into LangGraph

**Winner:** StateGraph (designed for this use case)

---

## Decision

We choose **LangGraph StateGraph** over hand-written loops.

---

## Rationale Summary

| Criterion | Hand-Written | StateGraph | Winner |
|-----------|-------------|-----------|---------|
| Initial complexity | Lower (fewer abstractions) | Higher (learning curve) | Hand-Written |
| Scalability | Poor (exponential complexity) | Excellent (linear growth) | **StateGraph** |
| Readability | Opaque (implicit flow) | Self-documenting (explicit graph) | **StateGraph** |
| State management | Manual, error-prone | Automatic via reducers | **StateGraph** |
| Observability | Manual instrumentation | Built-in event streaming | **StateGraph** |
| Testing | Integration tests only | Unit + integration testable | **StateGraph** |
| Extensibility | Requires refactoring | Additive changes only | **StateGraph** |
| Debugging | console.log driven | Event trace analysis | **StateGraph** |

**Conclusion:** StateGraph wins on 7 out of 8 dimensions (and the 1 loss is acceptable for a 2-week project).

---

## When to Use Hand-Written Loops

Despite our decision, hand-written loops are still appropriate for:

1. **Trivial Sequential Flows:**
   ```typescript
   const response1 = await agent1(input);
   const response2 = await agent2(response1);
   return response2;
   ```
   **No branching, no state, no cycles → Hand-written is fine**

2. **Prototyping:**
   - Quick proof-of-concept to test prompts
   - Will be replaced with proper architecture later

3. **Single-Agent Streaming:**
   - Just need to stream LLM output to user
   - No multi-agent coordination

**Rule of Thumb:**
- ≤ 2 agents + no branching → Hand-written
- ≥ 3 agents OR conditional flow → StateGraph

---

## Migration Path (If Starting Hand-Written)

If a project starts with hand-written loops and needs to migrate:

### Step 1: Extract Agent Functions
```typescript
// Before
const optResp = await llm.generate([...messages, "Argue positively"]);

// After
const optimistNode = async (state) => {
  const resp = await llm.generate([...state.messages, "Argue positively"]);
  return { messages: [resp] };
};
```

### Step 2: Map Control Flow to Edges
```typescript
// Before: if (round < 3) { continue; } else { break; }

// After: .addConditionalEdges("skeptic", (state) =>
  state.round < 3 ? "optimist" : END
);
```

### Step 3: Replace Loop with Graph Execution
```typescript
// Before
for (let i = 0; i < rounds; i++) { ... }

// After
const result = await graph.invoke(initialState);
```

**Estimated effort:** 4-8 hours for a 3-agent system.

---

## References

- [LangGraph vs LangChain: When to use what](https://blog.langchain.dev/langgraph-vs-langchain/)
- [Refactoring: Improving the Design of Existing Code](https://martinfowler.com/books/refactoring.html) (Replace Conditional with Polymorphism pattern)
- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/) (for persistent state across requests)

---

## Appendix: Real-World Complexity Example

### Requirement: "Add a confidence check where Skeptic can challenge Optimist to cite sources"

**Hand-Written Loops:**
```typescript
// Must insert nested if-else in Skeptic section
const skepResp = await callSkeptic(state);
if (skepResp.includes("CITE_SOURCES")) {
  const optCitation = await callOptimist({
    ...state,
    prompt: "Provide sources"
  });
  messages.push(optCitation);

  // Now does Skeptic respond again? Does this count as a round?
  // What if Skeptic still isn't satisfied?
  // Quickly becomes spaghetti code...
}
```

**StateGraph:**
```typescript
// Add two nodes
.addNode("citation_request", citationRequestNode)
.addNode("citation_response", citationResponseNode)

// Update routing
.addConditionalEdges("skeptic", (state) => {
  if (state.needsCitation) return "citation_request";
  if (state.round < 3) return "optimist";
  return "moderator";
})
.addEdge("citation_request", "citation_response")
.addEdge("citation_response", "skeptic");  // Loop back to Skeptic
```

**Winner:** StateGraph makes complex loops trivial.

---

## Revision History

| Date       | Version | Changes                                      |
|------------|---------|----------------------------------------------|
| 2025-11-26 | 1.0     | Initial comparison analysis                  |
