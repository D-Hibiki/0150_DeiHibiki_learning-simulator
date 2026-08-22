import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import {
  CitizenDecisionRequestSchema,
  decideWithOllama,
  getOllamaStatus,
} from "./ollama-policy";
import { isAllowedAgentMutationOrigin } from "./request-security";

const app = new Hono();
let inferenceInFlight = false;

app.use("*", async (context, next) => {
  context.header("Cache-Control", "no-store");
  context.header("X-Content-Type-Options", "nosniff");
  context.header("Referrer-Policy", "no-referrer");
  await next();
});

app.use("/api/agent-world/*", async (context, next) => {
  if (context.req.method !== "GET"
    && !isAllowedAgentMutationOrigin(context.req.header("Origin"))) {
    return context.json({ error: "forbidden_origin" }, 403);
  }
  await next();
});

app.use("/api/agent-world/*", bodyLimit({
  maxSize: 256 * 1024,
  onError: (context) => context.json({ error: "request_too_large" }, 413),
}));

app.get("/health", async (context) => context.json(await getOllamaStatus()));
app.get("/api/agent-world/status", async (context) => context.json(await getOllamaStatus()));

app.post("/api/agent-world/decide", async (context) => {
  if (inferenceInFlight) return context.json({ error: "inference_busy" }, 429);
  inferenceInFlight = true;
  try {
    const request = CitizenDecisionRequestSchema.parse(await context.req.json());
    const action = await decideWithOllama(request.observation, request.model, {
      inferenceSeed: request.inferenceSeed,
      expectedModelDigest: request.modelDigest,
      signal: context.req.raw.signal,
    });
    return context.json({ action });
  } catch (error) {
    if (error instanceof z.ZodError) return context.json({ error: "invalid_request", details: error.issues }, 400);
    if (error instanceof Error && error.message.includes("timed out")) {
      return context.json({ error: "inference_timed_out", message: error.message }, 504);
    }
    if (error instanceof Error && error.message.includes("cancelled")) {
      return context.json({ error: "inference_cancelled", message: error.message }, 408);
    }
    return context.json({ error: "decision_failed", message: error instanceof Error ? error.message : "unknown error" }, 503);
  } finally {
    inferenceInFlight = false;
  }
});

app.notFound((context) => context.json({ error: "not_found" }, 404));

const port = Number(process.env.AGENT_SERVER_PORT ?? 8787);
serve({ fetch: app.fetch, hostname: "127.0.0.1", port }, (info) => {
  console.log(`Agent server listening on http://127.0.0.1:${info.port}`);
});

export { app };
