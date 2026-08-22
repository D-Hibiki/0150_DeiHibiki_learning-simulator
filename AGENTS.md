# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Approved product decisions

- Visual source of truth: `docs/design/reference.png`.
- Model v1 uses learner ability uniformly distributed from 0.5 to 1.0, affinity variation uniformly distributed at plus or minus 0.1, largest-remainder cohort allocation, ceil for the lower 20 percent, and a reproducible 32-bit seed.
- Hybrid scoring remains `max(paper, digital)` and the UI must disclose that this mathematically makes hybrid weakly dominate either single channel under model v1.
- Multiple runs are Monte Carlo trials over synthetic cohorts. Reports must distinguish trial-distribution uncertainty from real-world social-survey validity and must not claim causal, population-representative, or predictive evidence.
- Keep the implemented browser-only Model v1 and the planned local LLM-based "Agent World" as separate products, schemas, result stores, test suites, and claims. Never silently substitute one for the other.
- Agent World is local-only: a local orchestration process may call Ollama on loopback, but browser code and the Sites deployment must not call Ollama. Sites remains Agent World-disabled.
- The deterministic simulation engine, not an LLM, is the source of truth for world state, tick order, action validation, conflict resolution, and metrics. Agents may only propose schema-constrained actions.
- Do not persist chain-of-thought, hidden reasoning, or Ollama `thinking` fields. Persist only the versioned prompt/input, validated final action, observable message, validation outcome, and resulting state transition needed for audit and replay.
- Agent World results are exploratory simulation outputs. Require paired controls, multiple replicates, predeclared metrics, and human review before describing an outcome as emergent; never present it as a real-population forecast without separate empirical validation.
- Keep tick scheduling and world arbitration in deterministic code. Do not use Agents SDK manager, handoff, or agents-as-tools patterns as the world-state controller. If `@openai/agents` is used around a local model adapter, disable remote tracing before the first run and prove that the run makes no non-loopback request.
