import { Agent, OpenAIProvider, run, setTracingDisabled } from "@openai/agents";
import { z } from "zod";
import { DEFAULT_OLLAMA_MODEL, OLLAMA_HOST } from "./ollama-policy";

const CouncilOutputSchema = z.object({
  hypothesis: z.string().min(1),
  falsifier: z.string().min(1),
  primaryComparison: z.literal("full-vs-no-interaction"),
  mandatoryControls: z.tuple([
    z.literal("full"),
    z.literal("no-interaction"),
    z.literal("no-memory"),
    z.literal("rule-baseline"),
  ]),
  limitation: z.string().min(1),
}).strict();

export type CouncilOutput = z.infer<typeof CouncilOutputSchema>;

export async function runCouncilCompatibilitySmoke(): Promise<CouncilOutput> {
  setTracingDisabled(true);
  const provider = new OpenAIProvider({
    apiKey: "ollama-local",
    baseURL: `${OLLAMA_HOST}/v1`,
    useResponses: false,
    strictFeatureValidation: true,
  });
  const model = await provider.getModel(DEFAULT_OLLAMA_MODEL);
  const agent = new Agent({
    name: "創発研究プロトコル監査役",
    model,
    instructions: [
      "You audit an exploratory LLM citizen simulation protocol.",
      "Do not claim human validity. Require interaction and control conditions.",
      "The primary comparison is full-vs-no-interaction and all four controls are mandatory.",
      "Do not use p-values, statistical significance, human population inference, or invented metrics.",
    ].join(" "),
    outputType: CouncilOutputSchema,
    modelSettings: { temperature: 0, maxTokens: 512, reasoning: { effort: "none" } },
  });
  const result = await run(agent, "相互作用による学習継続カスケードを反証可能な形で1件定義してください。", { maxTurns: 2 });
  return CouncilOutputSchema.parse(result.finalOutput);
}
