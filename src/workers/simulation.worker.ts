import { runExperiment, type SimulationConfig } from "../simulation";

type RunMessage = { type: "run"; config: SimulationConfig };

self.onmessage = (event: MessageEvent<RunMessage>) => {
  if (event.data.type !== "run") return;
  try {
    const result = runExperiment(event.data.config, {
      onProgress: ({ completed, total }: { completed: number; total: number }) => {
        self.postMessage({ type: "progress", completed, total });
      },
    });
    self.postMessage({ type: "complete", result });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "シミュレーションに失敗しました。",
    });
  }
};
