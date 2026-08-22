import { useEffect, useMemo, useRef, useState } from "react";
import { DownloadSimple, Flask, Robot, Stop, Warning } from "@phosphor-icons/react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { runAgentWorldExperiment } from "../agent-world/experiment";
import { graphologyNetworkProvider } from "../agent-world/graphology-network";
import { createHttpCitizenDecisionProvider, fetchAgentRuntimeStatus, type AgentRuntimeStatus } from "../agent-world/http-policy";
import {
  assessEmergence,
  type AgentWorldRunRecord,
  type CascadeThresholds,
  type EmergenceAssessment,
} from "../agent-world/metrics";
import {
  AGENT_WORLD_INFERENCE_SEED_STREAM,
  AGENT_WORLD_VERSION,
  DEFAULT_AGENT_WORLD_CONFIG,
  deriveInferenceSeed,
  deriveInferenceSeedBase,
  type AgentWorldExperimentResult,
  type WorldVariant,
} from "../agent-world/protocol";

const VARIANTS: WorldVariant[] = ["full", "no-interaction", "no-memory", "rule-baseline"];
const LABELS: Record<WorldVariant, string> = {
  full: "LLM市民＋相互作用＋記憶",
  "no-interaction": "相互作用なし",
  "no-memory": "記憶なし",
  "rule-baseline": "ルールベース",
};
const COLORS: Record<WorldVariant, string> = {
  full: "#078d89",
  "no-interaction": "#1457c7",
  "no-memory": "#db9500",
  "rule-baseline": "#6d7785",
};
const PILOT_THRESHOLDS: CascadeThresholds = {
  baselineWindowTicks: 2,
  baselineMaxContinuityShare: 0.5,
  cascadeMinContinuityShare: 0.75,
  onsetWindowTicks: 3,
  sustainTicks: 2,
  minimumCompletedRunsPerCondition: 3,
  minimumComparablePairs: 3,
  minimumFullCascadeIncidence: 2 / 3,
  minimumPrimaryRiskDifference: 1 / 3,
  minimumSecondaryRiskDifference: 1 / 3,
};

type PilotArtifact = {
  schemaVersion: "agent-world-report/0.1";
  generatedAt: string;
  protocol: {
    question: string;
    primaryHypothesis: "interaction-induced-continuity-cascade";
    thresholds: CascadeThresholds;
    limitations: string[];
  };
  model: {
    provider: "ollama-local";
    name: string;
    digest: string;
    promptVersion: string;
    actionSchemaVersion: string;
    engineVersion: string;
    generation: AgentRuntimeStatus["generation"];
    fallbackActions: 0;
  };
  inferenceRequests: Array<{
    replicateId: string;
    variant: Exclude<WorldVariant, "rule-baseline">;
    tick: number;
    citizenId: number;
    seed: number;
  }>;
  replicates: AgentWorldExperimentResult[];
  emergenceAssessment: EmergenceAssessment;
};

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function average(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function auc(result: AgentWorldExperimentResult, variant: WorldVariant): number {
  return average(result.byVariant[variant].tickMetrics.map((tick) => tick.opportunityRate));
}

function seedManifest(worldSeed: number) {
  return {
    initialization: { value: (worldSeed ^ 0x6d2b79f5) >>> 0, streamId: "initialization/xor" },
    network: { value: (worldSeed ^ 0x9e3779b9) >>> 0, streamId: "network/xor" },
    schedule: { value: worldSeed >>> 0, streamId: "schedule/base" },
    inference: {
      value: deriveInferenceSeedBase(worldSeed),
      streamId: AGENT_WORLD_INFERENCE_SEED_STREAM,
    },
  };
}

function emergenceRecords(replicates: readonly AgentWorldExperimentResult[]): AgentWorldRunRecord[] {
  return replicates.flatMap((replicate, index) => VARIANTS.map((variant) => ({
    runId: `${replicate.configSnapshot.worldSeed}:${variant}`,
    replicateId: `pilot-${index + 1}`,
    condition: variant,
    terminalStatus: "completed" as const,
    seeds: seedManifest(replicate.configSnapshot.worldSeed),
    // tick 8 is the preregistered partial-recovery intervention; the metric uses zero-based array position 7.
    shockTick: 7,
    continuityShareByTick: replicate.byVariant[variant].tickMetrics.map((tick) => tick.opportunityRate),
  })));
}

function inferenceRequestProvenance(replicates: readonly AgentWorldExperimentResult[]) {
  const variants: Array<Exclude<WorldVariant, "rule-baseline">> = [
    "full",
    "no-interaction",
    "no-memory",
  ];
  return replicates.flatMap((replicate, replicateIndex) => variants.flatMap((variant) =>
    replicate.byVariant[variant].actionLog.map((entry) => ({
      replicateId: `pilot-${replicateIndex + 1}`,
      variant,
      tick: entry.tick,
      citizenId: entry.citizenId,
      seed: deriveInferenceSeed(
        replicate.configSnapshot.worldSeed,
        entry.citizenId,
        entry.tick,
      ),
    }))));
}

function downloadJson(artifact: PilotArtifact): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(artifact, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `agent-world-${artifact.replicates[0]?.configSnapshot.worldSeed ?? "report"}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function buildConfig(worldSeed: number) {
  return {
    ...DEFAULT_AGENT_WORLD_CONFIG,
    worldSeed,
    environment: { ...DEFAULT_AGENT_WORLD_CONFIG.environment },
    environmentEvents: [
      { eventId: "digital-disruption", tick: 3, patch: { digitalAvailability: 0.15 } },
      { eventId: "partial-recovery", tick: 8, patch: { digitalAvailability: 0.75 } },
    ],
    network: { ...DEFAULT_AGENT_WORLD_CONFIG.network },
  };
}

export function AgentWorldLab() {
  const [status, setStatus] = useState<AgentRuntimeStatus | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [replicates, setReplicates] = useState<AgentWorldExperimentResult[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refreshStatus = async () => {
    try {
      const next = await fetchAgentRuntimeStatus();
      setStatus(next);
      setStatusError(false);
    } catch {
      setStatus(null);
      setStatusError(true);
    }
  };

  useEffect(() => {
    void refreshStatus();
    return () => abortRef.current?.abort();
  }, []);

  const summary = useMemo(() => {
    if (replicates.length === 0) return null;
    const byVariant = Object.fromEntries(VARIANTS.map((variant) => [
      variant,
      average(replicates.map((replicate) => auc(replicate, variant))),
    ])) as Record<WorldVariant, number>;
    const assessment = assessEmergence(emergenceRecords(replicates), PILOT_THRESHOLDS);
    return { byVariant, assessment };
  }, [replicates]);

  const trendData = useMemo(() => {
    if (replicates.length === 0) return [];
    return replicates[0].byVariant.full.tickMetrics.map((tick, index) => ({
      tick: tick.tick,
      ...Object.fromEntries(VARIANTS.map((variant) => [variant, replicates[0].byVariant[variant].tickMetrics[index].opportunityRate])),
    }));
  }, [replicates]);

  const runPilot = async () => {
    if (!status?.available || !status.modelInstalled || !status.modelDigest) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setError(null);
    setReplicates([]);
    setProgress(0);
    let decisions = 0;
    const totalDecisions = 3 * DEFAULT_AGENT_WORLD_CONFIG.citizenCount * DEFAULT_AGENT_WORLD_CONFIG.tickCount * 3;
    const completed: AgentWorldExperimentResult[] = [];
    try {
      for (let replicateIndex = 0; replicateIndex < 3; replicateIndex += 1) {
        const worldSeed = (DEFAULT_AGENT_WORLD_CONFIG.worldSeed + replicateIndex * 1_013_904_223) >>> 0;
        const policy = createHttpCitizenDecisionProvider({
          signal: controller.signal,
          worldSeed,
          modelDigest: status.modelDigest,
          onDecision: () => {
            decisions += 1;
            setProgress(decisions / totalDecisions);
          },
        });
        const result = await runAgentWorldExperiment(buildConfig(worldSeed), {
          networkProvider: graphologyNetworkProvider,
          policyFactory: () => policy,
        });
        completed.push(result);
        setReplicates([...completed]);
      }
      setProgress(1);
    } catch (runError) {
      if (!controller.signal.aborted) setError(runError instanceof Error ? runError.message : "実験に失敗しました。");
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  const artifact: PilotArtifact | null = replicates.length === 0 || !status?.modelDigest ? null : {
    schemaVersion: "agent-world-report/0.1",
    generatedAt: new Date().toISOString(),
    protocol: {
      question: "媒体アクセスの急変時、LLM市民の局所相互作用から学習機会の継続カスケードが生じるか",
      primaryHypothesis: "interaction-induced-continuity-cascade",
      thresholds: PILOT_THRESHOLDS,
      limitations: [
        "LLM市民は実在の人間や人口集団を代表しない",
        "同一モデルから作った市民は独立した専門家ではない",
        "この結果は探索的なモデル内証拠であり社会予測ではない",
      ],
    },
    model: {
      provider: "ollama-local",
      name: status.model,
      digest: status.modelDigest,
      promptVersion: status.promptVersion,
      actionSchemaVersion: status.actionSchemaVersion,
      engineVersion: AGENT_WORLD_VERSION,
      generation: status.generation,
      fallbackActions: 0,
    },
    inferenceRequests: inferenceRequestProvenance(replicates),
    replicates,
    emergenceAssessment: assessEmergence(emergenceRecords(replicates), PILOT_THRESHOLDS),
  };

  return (
    <main className="agent-lab">
      <section className="agent-hero">
        <div>
          <span className="agent-kicker"><Robot size={18} weight="fill" /> Agent World v0.1・探索的</span>
          <h2>LLM市民の相互作用から、学習継続パターンが創発するか</h2>
          <p>8人の匿名な合成市民が、局所観測・個別記憶・近隣メッセージから媒体を選びます。数値成果は決定的World Engineが計算し、相互作用なし・記憶なし・ルールベースと同じ初期条件で比較します。</p>
        </div>
        <div className={`runtime-card ${status?.modelInstalled ? "is-ready" : ""}`}>
          <strong>ローカルAI</strong>
          <span>{status?.message ?? (statusError ? "ローカルAgent Serverに接続できません。" : "確認中…")}</span>
          <small>{status ? `${status.model}・Ollama ${status.version ?? "-"}` : "この機能はWindowsローカル版専用です"}</small>
          {!running && <button className="secondary-button" type="button" onClick={() => void refreshStatus()}>再確認</button>}
        </div>
      </section>

      <section className="protocol-grid" aria-label="事前登録済み実験計画">
        <article><strong>社会</strong><span>匿名市民8人・2クラスター・静的ネットワーク</span></article>
        <article><strong>時間</strong><span>12 tick・3反復・1 tick遅延メッセージ</span></article>
        <article><strong>環境</strong><span>tick 3で電子アクセス15%、tick 8で75%へ部分回復</span></article>
        <article><strong>判定</strong><span>ODD固定cascade指標・Full対相互作用なしのpaired risk差 ≥33.3pt</span></article>
      </section>

      <div className="agent-actions">
        {running ? (
          <button className="danger-button" type="button" onClick={() => abortRef.current?.abort()}><Stop size={19} weight="fill" /> 実験を中止</button>
        ) : (
          <button className="primary-button" type="button" disabled={!status?.available || !status.modelInstalled} onClick={() => void runPilot()}><Flask size={20} weight="fill" /> 承認済みパイロットを実行</button>
        )}
        <div className="agent-progress" aria-label={`進捗 ${Math.round(progress * 100)}%`}><span style={{ width: `${progress * 100}%` }} /></div>
        <span aria-live="polite">{running ? `${Math.round(progress * 100)}%・市民の意思決定を順次実行中` : "推定864回のローカルLLM意思決定"}</span>
      </div>
      {error && <div className="error-message" role="alert">{error}</div>}

      {summary ? (
        <section className="agent-results" aria-labelledby="agent-results-title">
          <div className="section-heading">
            <div><h2 id="agent-results-title">創発検証レポート</h2><p>{replicates.length}/3反復完了・単位は市民ではなくシミュレーションrun</p></div>
            {artifact && <button className="secondary-button" type="button" onClick={() => downloadJson(artifact)}><DownloadSimple size={17} /> 再生用JSON</button>}
          </div>
          <div className={`emergence-verdict ${summary.assessment.status === "candidate_emergence" || summary.assessment.status === "robust_candidate" ? "is-candidate" : ""}`}>
            <strong>{summary.assessment.status === "candidate_emergence" ? "創発候補" : summary.assessment.status === "robust_candidate" ? "頑健な創発候補" : summary.assessment.status === "observed_pattern" ? "観測パターン" : "基準未達"}</strong>
            <span>Full cascade {summary.assessment.conditions.full.cascadeRuns}/{summary.assessment.conditions.full.completedRuns} run・Full−相互作用なし paired risk差 {summary.assessment.comparisons.primary.pairedRiskDifference === null ? "算出不可" : pct(summary.assessment.comparisons.primary.pairedRiskDifference)}</span>
            <p>{summary.assessment.status === "candidate_emergence" || summary.assessment.status === "robust_candidate" ? "ODDに事前登録したモデル内基準を満たしました。現実社会で妥当な発見という意味ではありません。" : summary.assessment.reasons.join(" ")}</p>
          </div>
          <div className="agent-summary-cards">
            {VARIANTS.map((variant) => <article key={variant}><span>{LABELS[variant]}</span><strong>{pct(summary.byVariant[variant])}</strong><small>学習機会AUC</small></article>)}
          </div>
          <div className="chart-panel agent-chart">
            <div className="chart-title-row"><strong>反復1・学習機会確保率の推移</strong><span>時間変化ではなくAgent Worldのtick</span></div>
            <ResponsiveContainer width="100%" height={310}>
              <LineChart data={trendData} margin={{ top: 12, right: 20, left: 4, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tick" />
                <YAxis domain={[0, 1]} tickFormatter={(value) => `${value * 100}%`} />
                <Tooltip formatter={(value) => pct(Number(value))} />
                <Legend formatter={(value) => LABELS[value as WorldVariant]} />
                {VARIANTS.map((variant) => <Line key={variant} type="monotone" dataKey={variant} stroke={COLORS[variant]} strokeWidth={variant === "full" ? 3 : 1.8} dot={false} />)}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : (
        <section className="agent-empty">
          <Flask size={38} />
          <strong>まだAgent Worldを実行していません</strong>
          <span>実行前の計画承認は10項目の推奨設定として固定済みです。部分実行や失敗runは創発候補に数えません。</span>
        </section>
      )}

      <section className="agent-limitations">
        <Warning size={20} weight="fill" />
        <div><strong>LLM市民は人間の代替ではありません</strong><p>モデルが生成する行動のもっともらしさ、同一LLM由来の共通バイアス、プロンプト感度、現実社会への外的妥当性は自動テストできません。ここで検証するのは、定義した仮想世界で相互作用依存のパターンが現れるかだけです。</p></div>
      </section>
    </main>
  );
}
