import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  ChartLineUp,
  CheckCircle,
  Circle,
  CloudArrowDown,
  FileCsv,
  FileJs,
  Info,
  Lightning,
  Play,
  Printer,
  Stop,
  TrendUp,
  Warning,
} from "@phosphor-icons/react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  buildReportArtifact,
  DEFAULT_CONFIG,
  ENVIRONMENTS,
  reportCsv,
  runExperiment,
  validateConfig,
  type ExperimentResult,
  type Infrastructure,
  type SimulationConfig,
  type TrialCount,
} from "./simulation";

const APP_VERSION = "1.0.0";
const INFRASTRUCTURES: Infrastructure[] = ["paper", "digital", "hybrid"];
const LABELS: Record<Infrastructure, string> = {
  paper: "紙のみ",
  digital: "電子のみ",
  hybrid: "紙＋電子",
};
const COLORS: Record<Infrastructure, string> = {
  paper: "#1457c7",
  digital: "#db9500",
  hybrid: "#078d89",
};
const SCENARIOS = [
  { id: "normal", label: "平常時", note: "通常の学習環境", icon: Circle },
  { id: "blackout", label: "停電", note: "電子利用可能率20%", icon: Lightning },
  { id: "rapidUpdate", label: "急激な情報更新", note: "紙教材鮮度50%", icon: Warning },
] as const;
type ViewId = "comparison" | "report" | "sensitivity";
type WorkerMessage =
  | { type: "progress"; completed: number; total: number }
  | { type: "complete"; result: ExperimentResult }
  | { type: "error"; message: string };

function pct(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

function points(value: number): string {
  return `${(value * 100).toFixed(1)}pt`;
}

function cloneConfig(config: SimulationConfig): SimulationConfig {
  return {
    ...config,
    composition: { ...config.composition },
    environment: { ...config.environment },
  };
}

function downloadText(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function environmentComment(config: SimulationConfig): string {
  if (config.environment.digitalAvailability <= 0.3) {
    return "電子端末の利用可能率が低いため、電子のみの到達率が下がりやすい条件です。紙＋電子では、利用可能な紙へ切り替えられる仮定が結果に表れます。";
  }
  if (config.environment.paperFreshness <= 0.6) {
    return "紙教材の鮮度が低いため、紙のみのスコアが下がりやすい条件です。電子教材の鮮度を変えて差の感度も確認できます。";
  }
  return "両媒体を利用でき、教材鮮度も同じ条件です。学習者の適性と基礎力による差を比較できます。";
}

function SettingNumber({
  id,
  label,
  value,
  min,
  max,
  step,
  unit,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="field-row">
      <label htmlFor={id}>{label}</label>
      <input
        className="number-input"
        id={id}
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="unit">{unit}</span>
    </div>
  );
}

function EnvironmentSlider({
  id,
  label,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="slider-row">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <output htmlFor={id}>{pct(value, 0)}</output>
    </div>
  );
}

function ResultTable({ result }: { result: ExperimentResult }) {
  return (
    <div className="metric-table-wrap">
      <table className="metric-table">
        <caption>3方式は各試行内で同じ仮想学習者集団を使用しています。</caption>
        <thead>
          <tr>
            <th scope="col">指標</th>
            {INFRASTRUCTURES.map((id) => (
              <th className={`${id}-text`} scope="col" key={id}>{LABELS[id]}</th>
            ))}
            <th scope="col">読み方</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">到達率（平均）</th>
            {INFRASTRUCTURES.map((id) => <td key={id}>{pct(result.summaries[id].attainmentRate.mean)}</td>)}
            <td>閾値以上の割合</td>
          </tr>
          <tr>
            <th scope="row">脱落率（平均）</th>
            {INFRASTRUCTURES.map((id) => <td key={id}>{pct(result.summaries[id].dropoutRate.mean)}</td>)}
            <td>閾値未満の割合</td>
          </tr>
          <tr>
            <th scope="row">下位20%平均</th>
            {INFRASTRUCTURES.map((id) => <td key={id}>{result.summaries[id].bottom20Mean.mean.toFixed(3)}</td>)}
            <td>取り残されやすい層のスコア</td>
          </tr>
          <tr>
            <th scope="row">中央95%試行範囲</th>
            {INFRASTRUCTURES.map((id) => {
              const interval = result.summaries[id].attainmentRate.percentileInterval95;
              return <td key={id}>{interval ? `${pct(interval.lower)}–${pct(interval.upper)}` : "算出不可"}</td>;
            })}
            <td>仮想集団を変えたときの広がり</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ComparisonView({ result }: { result: ExperimentResult }) {
  const chartData = INFRASTRUCTURES.map((id) => ({
    id,
    name: LABELS[id],
    rate: result.summaries[id].attainmentRate.mean * 100,
  }));
  const config = result.configSnapshot;
  return (
    <>
      <div className="chart-panel" aria-label="学習到達率の比較グラフ">
        <div className="chart-title-row">
          <strong>学習到達率</strong>
          <span>{config.trialCount}試行の平均・閾値 {pct(config.successThreshold, 0)}</span>
        </div>
        <ResponsiveContainer width="100%" height={310}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 14, right: 64, left: 10, bottom: 4 }} accessibilityLayer>
            <CartesianGrid stroke="#e3e8ef" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
            <YAxis type="category" dataKey="name" width={82} tick={{ fill: "#243b55", fontSize: 13 }} />
            <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, "到達率"]} />
            <ReferenceLine x={config.successThreshold * 100} stroke="#243b55" strokeDasharray="5 4" label={{ value: "判定閾値", position: "top", fill: "#506176", fontSize: 11 }} />
            <Bar dataKey="rate" radius={[0, 4, 4, 0]} label={{ position: "right", formatter: (value: unknown) => `${Number(value).toFixed(1)}%`, fill: "#1f3550", fontWeight: 700 }}>
              {chartData.map((entry) => <Cell key={entry.id} fill={COLORS[entry.id]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ResultTable result={result} />
      <div className="explanation-box">
        <h3>なぜこの結果？</h3>
        <p>{environmentComment(config)}</p>
      </div>
      <div className="scope-note">
        <h3>モデルv1の重要な帰結</h3>
        <p>紙＋電子は各学習者について max（紙スコア, 電子スコア）を使います。切替コストがないため、併用が単独方式以上になることは観測上の発見ではなく、数式から保証された性質です。</p>
      </div>
    </>
  );
}

function ReportView({ result }: { result: ExperimentResult }) {
  const artifact = useMemo(() => buildReportArtifact(result, { appVersion: APP_VERSION }), [result]);
  const csvFiles = useMemo(() => reportCsv(artifact), [artifact]);
  const config = result.configSnapshot;
  const reportName = `learning-infrastructure-model-v1-seed-${config.baseSeed}`;
  const paired = result.pairedDifferences;

  return (
    <div className="report-view">
      <div className="report-toolbar no-print">
        <button className="secondary-button" type="button" onClick={() => downloadText(`${reportName}.json`, JSON.stringify(artifact, null, 2), "application/json;charset=utf-8")}><FileJs size={18} /> JSON</button>
        <button className="secondary-button" type="button" onClick={() => downloadText(`${reportName}-summary.csv`, csvFiles.summaryCsv, "text/csv;charset=utf-8")}><FileCsv size={18} /> 集計CSV</button>
        <button className="secondary-button" type="button" onClick={() => downloadText(`${reportName}-trials.csv`, csvFiles.trialsCsv, "text/csv;charset=utf-8")}><CloudArrowDown size={18} /> 試行CSV</button>
        <button className="secondary-button" type="button" onClick={() => window.print()}><Printer size={18} /> 印刷・PDF保存</button>
      </div>
      <div className="report-intro">
        <strong>モデルv1 合成シミュレーションレポート</strong>
        <p>人間から回答を集めた社会調査ではありません。反復で把握できるのは、設定した数式と合成集団の中でのぶれと計算精度です。現実の教育効果・因果効果・母集団代表性・将来予測を示しません。</p>
      </div>
      <div className="report-grid">
        <section className="report-section">
          <h3>実行条件</h3>
          <dl className="key-values">
            <div><dt>モデル</dt><dd>v{result.modelVersion}</dd></div>
            <div><dt>PRNG</dt><dd>xoroshiro128plus</dd></div>
            <div><dt>Base Seed</dt><dd>{config.baseSeed}</dd></div>
            <div><dt>試行回数</dt><dd>{config.trialCount.toLocaleString()}回</dd></div>
            <div><dt>1試行の人数</dt><dd>{config.learnerCount.toLocaleString()}人</dd></div>
            <div><dt>成功閾値</dt><dd>{config.successThreshold.toFixed(2)}</dd></div>
          </dl>
        </section>
        <section className="report-section">
          <h3>生成仮定</h3>
          <dl className="key-values">
            <div><dt>学習基礎力</dt><dd>一様分布 0.5〜1.0</dd></div>
            <div><dt>適性の個人差</dt><dd>基準値 ±0.1</dd></div>
            <div><dt>人数端数</dt><dd>最大剰余法</dd></div>
            <div><dt>下位層</dt><dd>20%・人数切り上げ</dd></div>
          </dl>
        </section>
        <section className="report-section is-wide">
          <h3>試行を重ねたときの累積平均</h3>
          <p className="field-note">横軸は時間ではありません。異なる仮想集団を追加したときの平均値の安定を示します。</p>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={result.attainmentTrend} margin={{ top: 20, right: 18, left: 4, bottom: 8 }} accessibilityLayer>
              <CartesianGrid stroke="#e3e8ef" />
              <XAxis dataKey="trialIndex" tickFormatter={(value) => `${value}`} />
              <YAxis domain={[0, 1]} tickFormatter={(value) => `${Math.round(value * 100)}%`} />
              <Tooltip labelFormatter={(value) => `完了 ${value}試行`} formatter={(value, name) => [pct(Number(value)), LABELS[name as Infrastructure]]} />
              <Legend formatter={(value) => LABELS[value as Infrastructure]} />
              <Line type="monotone" dataKey="paper" stroke={COLORS.paper} dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="digital" stroke={COLORS.digital} dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="hybrid" stroke={COLORS.hybrid} dot={false} strokeWidth={2.4} />
            </LineChart>
          </ResponsiveContainer>
        </section>
        <section className="report-section is-wide">
          <h3>方式別要約</h3>
          <ResultTable result={result} />
        </section>
        <section className="report-section is-wide">
          <h3>同一試行内の方式間差</h3>
          <div className="metric-table-wrap">
            <table className="metric-table">
              <caption>各試行で先に差を計算してから要約しています。</caption>
              <thead><tr><th scope="col">比較</th><th scope="col">到達率差の平均</th><th scope="col">中央95%試行範囲</th><th scope="col">同率試行</th></tr></thead>
              <tbody>
                {([
                  ["hybrid-paper", "紙＋電子 − 紙のみ"],
                  ["hybrid-digital", "紙＋電子 − 電子のみ"],
                  ["paper-digital", "紙のみ − 電子のみ"],
                ] as const).map(([id, label]) => {
                  const item = paired[id];
                  const interval = item.attainmentRate.percentileInterval95;
                  return (
                    <tr key={id}>
                      <th scope="row">{label}</th>
                      <td>{points(item.attainmentRate.mean)}</td>
                      <td>{interval ? `${points(interval.lower)}〜${points(interval.upper)}` : "算出不可"}</td>
                      <td>{item.attainmentDirection.tied}/{config.trialCount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function SensitivityView({
  applyPreset,
}: {
  applyPreset: (changes: Partial<SimulationConfig["environment"]>, label: string) => void;
}) {
  const digitalSteps = [1, 0.8, 0.5, 0.2, 0];
  const paperSteps = [1, 0.8, 0.5, 0.2];
  return (
    <>
      <div className="report-intro">
        <strong>感度分析プリセット</strong>
        <p>反復回数を増やしてもモデル仮定の妥当性は高まりません。条件を段階的に変え、結論がどこで変化するか確認してください。選択すると設定へ反映され、再実行が必要になります。</p>
      </div>
      <div className="report-grid">
        <section className="report-section">
          <h3>電子利用可能率</h3>
          <div className="report-toolbar">
            {digitalSteps.map((value) => <button className="secondary-button" type="button" key={value} onClick={() => applyPreset({ digitalAvailability: value }, `電子利用可能率${value * 100}%`)}>{value * 100}%</button>)}
          </div>
          <p className="field-note">100 → 80 → 50 → 20 → 0%で紙の冗長性が効く境界を探索します。</p>
        </section>
        <section className="report-section">
          <h3>紙教材鮮度</h3>
          <div className="report-toolbar">
            {paperSteps.map((value) => <button className="secondary-button" type="button" key={value} onClick={() => applyPreset({ paperFreshness: value }, `紙教材鮮度${value * 100}%`)}>{value * 100}%</button>)}
          </div>
          <p className="field-note">100 → 80 → 50 → 20%で情報更新の影響を探索します。</p>
        </section>
        <section className="report-section is-wide">
          <h3>推奨する読み方</h3>
          <p className="trial-help">同じBase Seedと試行回数を維持して条件だけ変えると、仮想集団系列を揃えた比較になります。出力したJSONを各条件の記録として保存してください。本格的な大域感度分析・実測データ校正・外部検証はモデルv1の範囲外です。</p>
        </section>
      </div>
    </>
  );
}

export function App() {
  const [config, setConfig] = useState<SimulationConfig>(() => cloneConfig(DEFAULT_CONFIG));
  const [result, setResult] = useState<ExperimentResult>(() => runExperiment(DEFAULT_CONFIG));
  const [view, setView] = useState<ViewId>("comparison");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const compositionTotal = Object.values(config.composition).reduce((sum, value) => sum + value, 0);
  const stale = JSON.stringify(config) !== JSON.stringify(result.configSnapshot);
  const valid = compositionTotal === 100 && Number.isInteger(config.learnerCount) && config.learnerCount >= 10 && config.learnerCount <= 10_000 && Number.isInteger(config.baseSeed) && config.baseSeed >= 0 && config.baseSeed <= 0xffff_ffff;

  const patchConfig = (patch: Partial<SimulationConfig>) => {
    setConfig((current) => ({ ...current, ...patch }));
    setError(null);
  };

  const chooseScenario = (id: keyof typeof ENVIRONMENTS) => {
    patchConfig({ environmentId: id, environment: { ...ENVIRONMENTS[id] } });
  };

  const setEnvironmentValue = (key: keyof SimulationConfig["environment"], value: number) => {
    setConfig((current) => ({
      ...current,
      environmentId: "custom",
      environment: { ...current.environment, [key]: value },
    }));
    setError(null);
  };

  const run = () => {
    try {
      validateConfig(config);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "設定を確認してください。");
      return;
    }
    workerRef.current?.terminate();
    const worker = new Worker(new URL("./workers/simulation.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    setRunning(true);
    setProgress(0);
    setError(null);
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      if (event.data.type === "progress") {
        setProgress(event.data.completed / event.data.total);
      } else if (event.data.type === "complete") {
        setResult(event.data.result);
        setProgress(1);
        setRunning(false);
        worker.terminate();
        workerRef.current = null;
      } else if (event.data.type === "error") {
        setError(event.data.message);
        setRunning(false);
        worker.terminate();
        workerRef.current = null;
      }
    };
    worker.postMessage({ type: "run", config: cloneConfig(config) });
  };

  const cancel = () => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setRunning(false);
    setProgress(0);
    setError("実行を中止しました。前回完了した結果を表示しています。");
  };

  const newSeed = () => {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    patchConfig({ baseSeed: values[0] });
  };

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>学習インフラ冗長性シミュレーター</h1>
          <p>同一の仮想学習者集団に対して、紙・電子・紙＋電子の学習到達状況を比較する思考実験ツールです。</p>
        </div>
        <div className="caution-box" role="note">
          <Warning size={28} weight="fill" aria-hidden="true" />
          <div><strong>予測ではありません</strong><span>設定した仮定の中での計算結果です。現実の教育効果・因果効果・母集団代表性を示しません。</span></div>
        </div>
      </header>

      <section className="scenario-strip" aria-labelledby="scenario-title">
        <h2 id="scenario-title">シナリオを選択</h2>
        <div className="scenario-options">
          {SCENARIOS.map(({ id, label, note, icon: Icon }) => (
            <button className={`scenario-option ${config.environmentId === id ? "is-selected" : ""}`} type="button" key={id} aria-pressed={config.environmentId === id} disabled={running} onClick={() => chooseScenario(id)}>
              <Icon size={24} weight={config.environmentId === id ? "fill" : "regular"} aria-hidden="true" />
              <strong>{label}</strong><span>{note}</span>
            </button>
          ))}
        </div>
        {stale ? <div className="stale-badge">設定が変更されています<br />再実行が必要です</div> : <div className="stale-badge" style={{ color: "#176b54", background: "#eefaf5", borderColor: "#8ed2bc" }}>実行済み設定を表示中</div>}
      </section>

      <div className="page-grid">
        <main className="workspace">
          <div className="section-heading">
            <h2>シミュレーション結果</h2>
            <p>環境：{config.environmentId === "custom" ? "カスタム" : SCENARIOS.find((item) => item.id === result.configSnapshot.environmentId)?.label ?? "カスタム"}・Seed {result.configSnapshot.baseSeed}</p>
          </div>
          <nav className="view-tabs" aria-label="結果表示">
            {([
              ["comparison", "単回・平均比較"],
              ["report", "反復レポート"],
              ["sensitivity", "感度分析"],
            ] as const).map(([id, label]) => <button className={`view-tab ${view === id ? "is-selected" : ""}`} type="button" key={id} aria-current={view === id ? "page" : undefined} onClick={() => setView(id)}>{label}</button>)}
          </nav>
          {view === "comparison" && <ComparisonView result={result} />}
          {view === "report" && <ReportView result={result} />}
          {view === "sensitivity" && <SensitivityView applyPreset={(changes) => { setConfig((current) => ({ ...current, environmentId: "custom", environment: { ...current.environment, ...changes } })); setView("comparison"); }} />}
          <details className="assumptions">
            <summary>計算式・仮定・モデルv1を表示</summary>
            <div className="assumptions-content">
              <div><strong>紙スコア</strong> = 紙適性 × 紙利用可能率 × 紙教材鮮度 × 学習基礎力</div>
              <div><strong>電子スコア</strong> = 電子適性 × 電子利用可能率 × 電子教材鮮度 × 学習基礎力</div>
              <div><strong>紙＋電子</strong> = max（紙スコア, 電子スコア）。成功判定は最終スコア ≥ 閾値。</div>
              <div>学習基礎力は一様分布0.5〜1.0、適性はタイプ基準値±0.1。人数端数は最大剰余法、下位20%人数は切り上げます。</div>
              <div>反復ごとに異なる仮想集団を作り、その試行内では3方式に同じ集団を使います。</div>
            </div>
          </details>
        </main>

        <aside className="settings-panel" aria-labelledby="settings-title">
          <h2 id="settings-title">設定 <span className="field-note">（同一集団で比較）</span></h2>
          <div className="setting-group">
            <h3>基本設定</h3>
            <SettingNumber id="learner-count" label="学習者数" value={config.learnerCount} min={10} max={10_000} step={1} unit="人" disabled={running} onChange={(learnerCount) => patchConfig({ learnerCount })} />
            {(["paper", "digital", "hybrid"] as const).map((type) => (
              <div className="composition-row" key={type}>
                <label htmlFor={`composition-${type}`} className={`${type}-text`}>{type === "paper" ? "紙型" : type === "digital" ? "電子型" : "両用型"}</label>
                <input className="number-input" id={`composition-${type}`} type="number" min="0" max="100" step="1" value={config.composition[type]} disabled={running} onChange={(event) => setConfig((current) => ({ ...current, composition: { ...current.composition, [type]: Number(event.target.value) } }))} />
                <span className="unit">%</span>
              </div>
            ))}
            <p className={`composition-total ${compositionTotal !== 100 ? "is-error" : ""}`}>合計 {compositionTotal}%</p>
            <SettingNumber id="threshold" label="成功のしきい値" value={config.successThreshold} min={0} max={1} step={0.05} unit="0〜1" disabled={running} onChange={(successThreshold) => patchConfig({ successThreshold })} />
            <SettingNumber id="seed" label="Base Seed" value={config.baseSeed} min={0} max={0xffff_ffff} step={1} unit="32-bit" disabled={running} onChange={(baseSeed) => patchConfig({ baseSeed })} />
            <button className="secondary-button" type="button" disabled={running} onClick={newSeed}><TrendUp size={17} /> 別の集団系列</button>
          </div>

          <div className="setting-group">
            <h3>反復試行</h3>
            <div className="field-row">
              <label htmlFor="trial-count">試行回数</label>
              <select className="select-input" id="trial-count" value={config.trialCount} disabled={running} onChange={(event) => patchConfig({ trialCount: Number(event.target.value) as TrialCount })}>
                <option value="1">1回</option>
                <option value="10">10回</option>
                <option value="100">100回</option>
                <option value="1000">1,000回（推奨）</option>
              </select>
              <span className="unit">回</span>
            </div>
            <p className="trial-help">各試行で新しい合成集団を作ります。100回未満の分布範囲は探索的な参考値です。</p>
          </div>

          <div className="setting-group">
            <h3>環境パラメータ</h3>
            <EnvironmentSlider id="paper-availability" label="紙利用可能率" value={config.environment.paperAvailability} disabled={running} onChange={(value) => setEnvironmentValue("paperAvailability", value)} />
            <EnvironmentSlider id="digital-availability" label="電子利用可能率" value={config.environment.digitalAvailability} disabled={running} onChange={(value) => setEnvironmentValue("digitalAvailability", value)} />
            <EnvironmentSlider id="paper-freshness" label="紙教材鮮度" value={config.environment.paperFreshness} disabled={running} onChange={(value) => setEnvironmentValue("paperFreshness", value)} />
            <EnvironmentSlider id="digital-freshness" label="電子教材鮮度" value={config.environment.digitalFreshness} disabled={running} onChange={(value) => setEnvironmentValue("digitalFreshness", value)} />
          </div>

          <div className="run-actions">
            {running ? (
              <>
                <button className="danger-button" type="button" onClick={cancel}><Stop size={20} weight="fill" /> 実行を中止</button>
                <div className="progress-track" aria-label={`進捗 ${Math.round(progress * 100)}%`}><div className="progress-fill" style={{ width: `${progress * 100}%` }} /></div>
                <p className="run-status" aria-live="polite">{Math.round(progress * 100)}%・仮想集団を生成して比較中</p>
              </>
            ) : (
              <>
                <button className="primary-button" type="button" disabled={!valid} onClick={run}><Play size={21} weight="fill" /> シミュレーション実行</button>
                <p className="run-status"><CheckCircle size={14} weight="fill" aria-hidden="true" /> 同じ設定とSeedで結果を再現できます</p>
              </>
            )}
            {error && <div className="error-message" role="alert">{error}</div>}
          </div>
        </aside>
      </div>
    </div>
  );
}
