# Agent World v1: ODD protocol and preregistered emergence assessment

Status: implementation protocol. This document describes a computational experiment with LLM-generated agents. It does not describe a survey, a human sample, a population estimate, or a digital twin.

> Agent Worldの構成員は、同一の言語モデル、versioned prompt、明示した状態遷移規則から生成される計算主体です。人間の参加者・回答者・社会集団の代表者ではありません。結果はモデル内のrun分布であり、現実の教育効果、因果効果、人口分布、将来予測を示しません。

## 1. Purpose and patterns

### Purpose

利用可能な学習手段に関する情報をLLM agent同士が交換したとき、個々のaction ruleへ直接書かれていないpopulation-levelの学習継続cascadeが、相互作用なし・memoryなし・rule-basedの各controlより多く生じるかを、モデル内部で検証する。

人間社会への一般化、政策判断、人口推定、教育効果の推定は目的外である。

### Primary pattern

Primaryは `interaction-induced continuity cascade` とする。`src/agent-world/metrics.ts` は、各simulation runの `continuityShareByTick` について次を全て満たす場合だけcascadeと判定する。

1. shock直前の事前登録baseline window内の最大継続割合が `baselineMaxContinuityShare` 以下。
2. shockから `onsetWindowTicks` 以内に継続割合が `cascadeMinContinuityShare` 以上へ到達。
3. その状態が連続 `sustainTicks` 継続。

数値閾値にdefaultは設けない。confirmatory runを開く前に、次の全値をstudy protocolへ記録し、protocol hashを固定しなければ実行してはならない。

- `baselineWindowTicks`
- `baselineMaxContinuityShare`
- `cascadeMinContinuityShare`
- `onsetWindowTicks`
- `sustainTicks`
- `minimumCompletedRunsPerCondition`
- `minimumComparablePairs`
- `minimumFullCascadeIncidence`
- `minimumPrimaryRiskDifference`
- `minimumSecondaryRiskDifference`

pilotで値を決める場合、そのpilot seedとrunはconfirmatory analysisへ含めない。

### Assessment unit

推論単位はagent、message、tickではなく、独立に初期化された `simulation run` である。100 agentsを100人や `n=100` の人間標本として扱わない。

## 2. Entities, state variables, and scales

### Agent

MVP agentは人名や人口属性personaを持たない。paper-adapted、digital-adapted、dual-channelに対応する行動関連のtyped stateだけを持つ。

- affinity and learning ability
- channel availability and freshness
- current channel and continuity state
- bounded memory, when the condition enables it
- allowed action enum

自然言語出力はenvironment stateを直接更新しない。orchestratorがschema-validなactionを検証してから適用する。

### Environment

- current tick and preregistered shock tick
- paper/digital availability and freshness
- interaction network
- public observations
- current population continuity share

### Scale

時間単位は抽象tickであり、暦時間ではない。agent数、tick数、network規模はstudy protocolで固定する。

## 3. Process overview and scheduling

1. Domain-separated seed manifestからinitial state、network、schedule、model inference streamを初期化する。
2. 同じ `replicateId` の4条件へ同じseed manifestを割り当てる。
3. 各tickでorchestratorが観測可能stateを生成する。
4. 条件に応じてpeer messageとmemoryを入力へ含める。
5. LLMまたはrule policyがallowed actionを提案する。
6. schema、state invariant、future-state参照を検証する。
7. 事前登録したsynchronous/asynchronous scheduleでactionを適用する。
8. population continuity shareを1回記録する。
9. timeout、cancel、schema failureはterminal failureとして保存し、部分runをcompletedにしない。
10. 全run終了後に固定analysis codeでcascadeとcontrol差を計算する。

## 4. Design concepts

### Emergence

個々のprompt、reward、termination rule、network construction、aggregatorにcascade targetを直接記載しない。macro thresholdをagentへ知らせない。これらへpatternが埋め込まれていた場合、結果は `imposed` でありemergence statusを付けない。

### Adaptation and objectives

agentは利用可能なchannelから次のactionを選ぶ。目的・action spaceはprotocolに明記し、LLMへ自由なtool、network、file accessを与えない。

### Sensing

agentが観測できるstate fieldをschemaで固定する。hidden stateとfuture stateは渡さない。

### Interaction

Fullのみがpeer messageを受け取る。messageのrecipient、順序、長さ、memory反映規則をprotocolで固定する。

### Stochasticity

次を別streamとして記録する。

- initialization
- network
- schedule
- inference

各streamはunsigned 32-bit valueと一意の `streamId` を持つ。同一replicateのcontrol間では全manifestを一致させる。seed不一致pairはpaired comparisonから除外し、件数を報告する。

実装はinitialization、network、schedule、inferenceの4 streamを完全一致で検証し、欠落・追加streamを許可しない。各LLM decisionのSeedはversioned inference baseとworld/citizen/tickから導出してOllamaへ渡し、artifactへ個別記録する。replayは保存済みresultのnetwork、action log、variantをそのまま使用し、別generatorでnetworkを再生成しない。

### Observation

run trace、model/prompt/persona/network/analysis version、全terminal statusを記録する。自然言語の面白さや別のLLMによる採点をcascade detectorに使わない。

## 5. Initialization

confirmatory run開始前に次を固定する。

- agent count and role composition
- initial agent state distribution
- tick count and shock tick
- primary network topology and network parameters
- update schedule
- model name and digest
- Ollama version and inference options
- prompt and action-schema hashes
- seed derivation version
- cascade thresholds
- failure and exclusion policy
- robustness check inventory

## 6. Input data

Agent World v1は合成stateだけを使用する。人間の回答、個人情報、自由記述、外部Web、実測データを入力しない。現行 `src/simulation/**` の決定論的モデルを変更せず、Agent Worldは別experiment layerとして扱う。

## 7. Submodels

### Conditions

| Condition | Interaction | Memory | Decision policy | Role in assessment |
|---|---:|---:|---|---|
| Full | on | on | LLM | Primary treatment |
| No-interaction | off | otherwise matched | LLM | Primary control |
| No-memory | on | off | LLM | Secondary mechanism control |
| Rule (`rule-baseline`) | matched environment | explicit in protocol | Rule-based | Secondary policy control |

Full vs No-interactionが唯一のprimary contrastである。No-memoryとRuleはsecondary controlsであり、primary failure後にemergence claimを救済するために使わない。

### Status decision

| Status | Required conditions |
|---|---|
| `observed_pattern` | Fullのvalid completed run数とcascade incidenceが事前閾値以上 |
| `candidate_emergence` | observed_patternに加え、paired Full − No-interaction risk differenceがprimary閾値以上 |
| `robust_candidate` | candidate_emergenceに加え、No-memoryとRuleのpaired差がsecondary閾値以上で、全preregistered prompt/persona/network robustness checksがpass |

Fullがobserved-pattern閾値に届かない場合、statusは `null` として理由を報告する。いずれの閾値も人間社会の有意差や信頼区間ではない。statusはmodel-internal evidenceの段階だけを示す。

### Paired comparison

同じ `replicateId` と完全一致するseed manifestを持つcompleted runだけをpairにする。paired risk differenceは、各pairの `Full cascade indicator − control cascade indicator` の平均である。

agent、message、tickを独立観測としてcountしない。minimum pair数未満の場合、primaryはnot evaluableとする。

### Failure and exclusion

- `failed`、`cancelled`、`timed-out`、`invalid` は分子・分母の両方から除外する。
- invalid time seriesとinvalid seed manifestも除外する。
- failureをno-cascadeとしてimputeしない。
- controlの片方だけがfailedの場合、そのreplicateはpaired comparisonから外す。
- condition別total、valid completed、excluded、reason別件数を必ず報告する。
- 同じcondition/replicateの複数terminal recordを拒否する。retryを選択的に採用しない。retry policyと最終recordのadjudicationはrunner側protocolで事前固定する。
- failure率が事前上限を超えたstudyはstatusを公開せず、inconclusiveとして停止する。

## Robustness and publication boundary

`robust_candidate` には、結果を見る前に登録したprompt paraphrase、persona label removal、network topology/seed sensitivityを全て含める。label/order変更だけで結論が反転した場合はprompt/persona artefactとして停止する。

許可する表現：

> model、prompt、network、thresholdを固定した計算実験で、事前定義したcontinuity cascadeがFull条件でcontrolより多く観測され、model-internal statusはcandidate_emergenceだった。

禁止する表現：

- 人間社会で創発した、または創発する
- LLM agentsが人間100人を再現した
- 世論、社会調査、教育効果、因果効果、人口代表性、将来予測
- 1つの印象的なtraceや会話を創発の証拠にする
- failed、excluded、null、sensitivity reversalを非掲載にする

公開にはmethodology、statistics、social-science/ethics、security、operationsの人間承認を必要とする。
