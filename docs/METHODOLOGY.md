# 学習インフラ冗長性シミュレーター：方法論

最終更新: 2026-08-16
対象: モデル v1

## 1. 目的と適用範囲

本アプリは、紙・電子・紙＋電子という学習インフラを、明示した仮定の下で比較する合成コホート・シミュレーションである。目的は、仮定を変更したときにモデル内の結果がどう変わるかを観察し、現実の社会調査や実証研究で検証すべき仮説を作ることにある。

本アプリは人間から回答や測定値を収集しない。したがって、表示結果は世論調査、標本調査、実験、観察研究、因果効果の推定、将来予測、または特定の母集団に対する代表推計ではない。反復回数を増やすと乱数によるモンテカルロ誤差は小さくなるが、モデル式、入力分布、欠落変数、現実への適合性に関する不確実性は小さくならない。

レポートと画面では、次の注意を常に明示する。

> 本結果は、設定した数式と合成した仮想学習者に条件づけた計算実験です。人間から回答を収集した社会調査ではなく、現実の教育効果、因果効果、将来値、母集団代表性を示しません。

## 2. 公式・一次資料と採用範囲

| 参照元 | 採用する原則 | 本アプリへの適用範囲 |
|---|---|---|
| [AAPOR Code of Professional Ethics and Practices](https://aapor.org/standards-and-ethics/) | 参加者・回答者は人間であり、研究方法、生成方法、品質管理、限界を開示する | 仮想学習者を「回答者」や「調査標本」と呼ばない。生成手順と限界をレポートに載せる |
| [AAPOR Disclosure Standards](https://aapor.org/standards-and-ethics/disclosure-standards/) | 第三者が検証できる方法情報、標本規模、精度、モデル仕様・仮定、限界を開示する | Seed、モデル版、入力、反復数、式、集計規則、未検証事項を出力する。「現実の誤差 ±x%」とは表示しない |
| [Morris, White, Crowther (2019), Using simulation studies to evaluate statistical methods](https://doi.org/10.1002/sim.8086)（[オープン版](https://pmc.ncbi.nlm.nih.gov/articles/PMC6492164/)） | ADEMP、モンテカルロ標準誤差、同じ生成データによる方式比較、Seed/RNG 状態の再現性 | 目的、生成機構、評価対象、方式、性能指標を分離し、paired comparison と MCSE を採用する |
| [U.S. EPA, Guidance on the Development, Evaluation, and Application of Environmental Models](https://nepis.epa.gov/Exe/ZyPURL.cgi?Dockey=P1003E4R.TXT) | モデル枠組み・入力・適用範囲の不確実性を区別し、実測との照合、独立検証、感度・不確実性分析を行う | 仮想集団の偶然変動とモデル不確実性を分離し、外的妥当性を「未検証」とする |
| [U.S. EPA, Guiding Principles for Monte Carlo Analysis](https://nepis.epa.gov/Exe/ZyPURL.cgi?Dockey=30004ZGL.TXT) | 重要な入力・仮定・代替モデルを感度分析し、中心だけでなく分布の裾も確認する | 環境、学習者構成、成功閾値を変え、平均だけでなく分位点も比較する |
| [NIST, Consistency in Monte Carlo Uncertainty Analyses](https://www.nist.gov/publications/consistency-monte-carlo-uncertainty-analyses) | 解析全体で一貫した再現可能な反復を用いる | master seed、PRNG、モデル版を固定し、方式間・レポート間で同じ反復を参照する |
| [JCGM 101:2008](https://doi.org/10.59161/JCGM101-2008) | 分位点・coverage interval の端点は平均より収束が遅く、必要精度に応じて反復数を評価する | 分位点の安定性警告と MCSE を表示する。計量学固有の手順を社会モデルの妥当性保証には転用しない |

これらは方法論上の原則を参照するものであり、公的機関が本モデルまたはその社会的解釈を承認したことを意味しない。

## 3. ADEMP によるモデル v1 の定義

### Aim: 目的

同じ仮想学習者集団に対して、紙のみ、電子のみ、紙＋電子の3方式を適用し、指定環境での到達率、脱落率、下位20%平均スコア、および方式間差を比較する。

### Data-generating mechanism: データ生成機構

- 学習者数は 10〜10,000 人。
- 紙型、電子型、両用型の人数は、指定割合から最大剰余法で整数へ割り当てる。
- 基準適性は紙型 `(紙 0.9, 電子 0.3)`、電子型 `(紙 0.3, 電子 0.9)`、両用型 `(紙 0.8, 電子 0.8)`。
- 各適性には独立な一様分布 `U(-0.1, 0.1)` の個人差を加え、0〜1へ収める。
- 学習基礎力は一様分布 `U(0.5, 1.0)` から生成する。
- 32-bit master seed と固定した疑似乱数生成器を用いる。同じモデル版、Seed、入力なら同じ結果を返す。
- 複数回試行では各反復に別の合成コホートを生成する。ただし、1反復内の3方式は必ず同一コホートを使う。

### Estimands / targets: 評価対象

本アプリが推定する対象は、現実母集団の値ではなく、指定したモデル v1 と入力に条件づけた次の量である。

- 各方式の反復平均到達率
- 各方式の反復平均脱落率
- 各方式の反復平均下位20%スコア
- 同一反復内で計算した方式間差の平均と分布
- 反復を重ねたときの各推定値の数値的収束

### Methods: 比較方式

学習者 `k` の紙・電子スコアを次で計算する。

```text
paperScore_k = paperAffinity_k
             * paperAvailability
             * paperFreshness
             * learningAbility_k

digitalScore_k = digitalAffinity_k
               * digitalAvailability
               * digitalFreshness
               * learningAbility_k
```

最終スコアは、紙のみでは `paperScore`、電子のみでは `digitalScore`、紙＋電子では `max(paperScore, digitalScore)` とする。最終スコアが成功閾値以上なら到達と判定する。

`max` を使うため、モデル v1 の紙＋電子は数式上、各単独方式を弱く支配し、単独方式より低いスコアにはならない。これは観測された社会的事実ではなくモデル式の帰結であり、レポートに必ず表示する。

### Performance measures: 反復内指標

方式 `j`、反復 `i` について次を保存する。

- 到達率 `r[i,j] = 到達者数 / 学習者数`
- 脱落率 `1 - r[i,j]`
- 下位20%平均 `b[i,j]`

下位20%は最終スコアを昇順に並べ、`ceil(学習者数 * 0.2)` 人を抽出して算術平均する。

## 4. 反復集計

反復数を `R`、対象指標の反復値を `x[1] ... x[R]` とする。`R = 1` では単回値のみを示し、反復分布や MCSE は計算しない。

### 代表値と分位点

- 平均: `mean = sum(x[i]) / R`
- 中央値: 50パーセンタイル
- IQR: 25パーセンタイルと75パーセンタイル
- モデル内95%反復分布範囲: 2.5パーセンタイルと97.5パーセンタイル

分位点は、昇順値 `x(1) ... x(R)` に対する Hyndman–Fan type 7 の線形補間で定義する。確率 `p` に対し `h = (R - 1) * p + 1` とし、隣接する順位の値を `h` の小数部分で線形補間する。これはモデル内の別コホートで起こる反復分布の記述であり、現実社会に対する信頼区間ではない。

### モンテカルロ標準誤差

反復標準偏差を

```text
s = sqrt(sum((x[i] - mean)^2) / (R - 1))
```

とし、平均のモンテカルロ標準誤差を

```text
MCSE(mean) = s / sqrt(R)
```

とする。`R >= 100` では数値誤差の目安として、平均の近似95%モンテカルロ区間を

```text
mean ± 1.96 * MCSE(mean)
```

で示す。これは、同じ設計を別の乱数列で有限回反復した場合の平均推定のばらつきを表し、現実の教育効果の95%信頼区間ではない。`R < 100` は探索的結果として表示し、95%区間を強い根拠として扱わない。

### 推奨反復数

- 1回: 個別コホートの観察
- 10回: 動作確認
- 100回: 探索
- 1,000回: 標準レポートの推奨値
- 5,000〜10,000回: 分布端点をより安定させる高精度確認。端末負荷を伴う

固定回数だけで精度を保証せず、最終的には表示された MCSE と分位点の安定性で判断する。0〜1の任意の反復値について、1,000回時の平均 MCSE の理論上の上限は約0.0158、近似95%半幅の上限は約0.031である。実際の精度には観測した反復標準偏差を使う。

## 5. Paired comparison

方式比較では各方式を別々の仮想集団で実行しない。同一反復 `i` の同一コホートから、方式 `A` と `B` の差を

```text
d[i,A-B] = x[i,A] - x[i,B]
```

として計算する。紙−電子、紙＋電子−紙、紙＋電子−電子について、差の平均、中央値、P2.5、P25、P75、P97.5、平均の MCSE、正・同率・負の反復割合を集計する。

紙＋電子の勝率や統計的有意性は強調しない。`max` による構造的優位があるため、主に改善幅と同率割合を報告する。p値や「有意差」は出力しない。

## 6. 収束推移

推移グラフは社会の暦時間ではなく、反復回数に対する推定値の収束を表す。反復 `k` までの累積平均と累積 MCSE を表示し、横軸を「反復回数」、図題を「反復に伴う推定値の収束」とする。

- 3方式の累積平均到達率
- 十分な反復後の累積 `±1.96 * MCSE` 帯
- 方式間paired差の累積平均
- 10、50、100、250、500、1,000などのチェックポイント

グラフには「暦時間や社会変化の推移ではない」と明記する。最終チェックポイントの累積平均は最終集計平均と完全に一致しなければならない。

## 7. 感度分析と不確実性の分離

反復が扱うのは、固定したモデルとパラメータの下での合成コホートの偶然変動である。次の不確実性を区別する。

- 偶然変動: 仮想学習者の個人差。複数回試行と MCSE で評価する。
- 入力・パラメータ不確実性: 利用可能率、教材鮮度、構成比、成功閾値。感度分析で評価する。
- モデル枠組み不確実性: 一様分布、±0.1、変数の独立性、乗算式、`max` 等の仮定。反復数を増やしても解消しない。
- 適用範囲・外的妥当性: 現実の人や地域・時期へ一般化できるか。現実データなしでは評価できない。

モデル v1 では次を感度分析プリセットとする。

- 電子利用可能率: 100%、80%、50%、20%、0%
- 紙教材鮮度: 100%、80%、50%、20%
- 学習者構成: 紙型多め、電子型多め、均衡
- 成功閾値: 複数段階
- 環境: 平常、停電、急激な情報更新

比較可能なシナリオでは同じ master seed と反復番号を使い、共通乱数によるpaired比較にする。シナリオごとに平均だけでなく P2.5、中央値、P97.5 と paired差を報告する。本格的な大域感度分析、仮説検定、Sobol指標はモデル v1 の範囲外とする。

## 8. レポートの再現情報

レポートには最低限、次を含める。

- 生成日時、モデル版、PRNG名と版、32-bit master seed
- 全入力値、環境プリセット、学習者数、反復数
- 学習者生成分布、最大剰余法、下位20%の切り上げ規則
- 3方式の算式と、`max` による構造的優位の注記
- 平均、中央値、P25/P75、P2.5/P97.5、MCSE
- paired方式間差、収束推移、感度分析
- 完了反復数、失敗・キャンセル・除外の件数と理由
- 解釈、限界、外的妥当性が未検証であること
- 再現用設定JSONと集計CSV

乱数生成器は開始時に一度だけ初期化する。同じSeedへ各反復で戻して同じコホートを再利用してはならない。反復開始状態または安全に導出した反復Seedを追跡し、Worker数やバッチサイズを変えても同じ結果になるようにする。

## 9. モデルQAとテスト要件

自動テストで次を確認する。

- 同じモデル版・Seed・設定で結果が完全一致する。
- 異なる反復で同じコホートを誤って再利用しない。
- 同一反復内の3方式が同一学習者集団を参照する。
- 適性、基礎力、各スコアが仕様範囲内にある。
- 到達率と脱落率の和が1になる。
- 紙＋電子が厳密に `max(紙, 電子)` で、単独方式未満にならない。
- 最大剰余法の人数合計が学習者数と一致する。
- 下位20%人数が `ceil(N * 0.2)` と一致する。
- 反復1回の結果が単回シミュレーションと一致する。
- 既知配列に対する平均、中央値、type 7分位点、標準偏差、MCSEが期待値と一致する。
- paired差が同じ反復の方式差から計算される。
- 推移の最終値、表、グラフ、CSV、JSONが同じ集計SSOTと一致する。
- Worker分割、チャンクサイズ、進捗更新の頻度が結果を変えない。
- キャンセルや例外発生時に途中結果を「完了」と表示しない。
- 大きな固定Seed標本で生成分布のモーメントが仕様上の許容範囲に入る。
- 環境入力0・1、閾値0・1、最小・最大人数で不正値や非有限値を生じない。

自動テストでは、モデルの社会科学的妥当性、説明の中立性、現実の人への一般化、重要な欠落変数、利用者が注意書きを正しく理解したかは確認できない。これらは専門家レビューと実測研究が必要である。

## 10. 外的妥当性を検証する将来要件

現実社会について推論する段階へ進む場合は、モデル v1 とは別の研究計画として、少なくとも次を事前に定義する。

1. 研究質問、対象母集団、地域、期間、主要評価項目。
2. 確率標本、または非確率標本を使う根拠と選択・非回答バイアスへの対応。
3. 学習適性、利用可能性、教材鮮度、学習到達を測る妥当な尺度。
4. 人を対象とする研究の倫理審査、同意、未成年者対応、個人情報保護。
5. 実測データを用いたパラメータ校正。ただし校正データと検証データを分離する。
6. 校正に使っていない独立データでの外部検証と、事前に定めた合否基準。
7. 代替分布、変数間相関、追加変数、代替結合式を含む構造感度分析。
8. 実測とモデル予測の不一致、適用できる条件、失敗事例の公開。
9. 研究プロトコル、分析計画、コード、モデル版、データ来歴の監査可能な記録。

これらを完了するまでは、本アプリの結果を政策判断や教育効果の根拠として単独利用しない。

## 11. Agent Worldの別研究計画

### 11.1 Model v1との境界

Agent Worldは、社会構成員そのものをLLM actorとして模倣し、局所相互作用から集団パターンが生じるかを探索する**別モデル・別実験**である。Model v1の式、Seed、`ExperimentResult`、反復分布へAgent Worldの出力を混ぜない。UIやレポートで比較する場合も、モデル名、version、データ生成機構、妥当性の限界を分離表示する。

Model v1の結果は固定数式に条件づけたMonte Carlo結果であり、Agent Worldの結果は特定のLLM、prompt、memory、scheduler、相互作用規則に条件づけたagent-based simulation結果である。どちらも実測社会調査、因果推論、母集団推定、将来予測ではない。

Agent Worldの完全なODD記述は [agent-world-odd.md](agent-world-odd.md) をSSOTとし、本節は評価原則とgateだけを定める。実装とODDが異なる場合は実験を開始せず、ODD、manifest schema、test fixtureを同じ変更で更新する。

### 11.2 採用する既存知見と自前実装

| 分類 | 内容 | 採用・不採用理由 |
|---|---|---|
| 既存機能 | Ollamaのlocal API、seed、生成parameter、JSON Schema、token/duration計測 | 推論transportと構造化最終応答に採用。仕様は[Chat API](https://docs.ollama.com/api/chat)と[Modelfile](https://docs.ollama.com/modelfile)に固定する |
| 既存研究 | [Generative Agents](https://arxiv.org/html/2304.03442)のobservation、memory、component ablation | bounded memoryとablationの基礎に採用。reflection/planningはAgent World v1の必須機能にしない |
| 既存評価 | [SOTOPIA](https://arxiv.org/html/2310.11667)のprivate goal、partial knowledge、goal/believability/relationship/knowledge/secret/social rule/material benefit | actor品質の副次評価に採用。LLM judge単独は不採用 |
| 既存標準 | [ODD protocol](https://www.jasss.org/23/2/7.html) | モデル記述、実験再実装、pattern-oriented evaluationに採用 |
| 自前実装 | world engine、二相tick、観測filter、有限action schema、validation、競合解決、control、event replay、決定論的metrics | LLM基盤が提供せず、実験の内部妥当性に必須 |
| 不明 | typed actor stateが目的に十分か、モデル間頑健性、必要replicate数、16GB GPUでの実行時間 | pilotと独立した人間データなしには確定しない。Agent World v1は人間代表性を主張しない |

### 11.3 創発の操作的定義

次の全条件を満たす場合だけ、結果を「創発候補」と呼ぶ。

1. 集団パターンを個々のprompt、action rule、競合解決規則へ直接書いていない。
2. 局所観測とactor間相互作用の反復から発生する。
3. 同一の初期world、人口、shock、環境Seedを共有するno-interaction対照との差が、複数replicateで一貫する。
4. 主要指標、除外規則、停止条件をpilot後・本試験前に固定している。
5. deterministic metricまたはcondition-blindの人間評価で確認し、同一/類似LLM judgeの評点だけに依存しない。

Agent World v1のprimary patternは、[ODD](agent-world-odd.md)で定義する`interaction-induced continuity cascade`である。shock前baseline、onset window、最低継続割合、sustain ticksを全て満たすrun-level indicatorを使い、primary contrastはseed manifestが完全一致するFull対No-interactionのpaired risk differenceとする。閾値に既定値を置かず、pilotをconfirmatoryから除外した上でstudy protocol hashへ固定する。agent、message、tickを独立標本として数えない。

情報到達率・到達時間、参加率、network density/clustering/modularity、行動entropy、学習継続率AUC、最悪群の継続率、媒体切替、復旧時間、access gapはsecondary/exploratory指標候補であり、primary失敗後にemergence claimを救済するために使わない。

[Generative Agents](https://arxiv.org/html/2304.03442)は情報伝播、関係graphのdensity、招待後の参加を記述的に測定した。一方、[SOTOPIA-π](https://aclanthology.org/2024.acl-long.698/)は、社会interaction向けに訓練したagentをLLM evaluatorが過大評価し得ることを報告している。このため、自然な会話やbelievabilityだけを創発の証拠にしない。

### 11.4 対照・ablation

pilotは最低限、次の4条件を同じ初期条件でpaired実行する。

1. Full: interaction on＋bounded memory on＋LLM decision policy。
2. No-interaction: actorは同じ環境を観測するが、他actorの発話・行動結果を観測しない。
3. No-memory: interactionは維持するが、bounded memoryを入力へ含めない。
4. Rule (`rule-baseline`): 同じworld、人口、network、shockで事前定義した非LLM policyを使う。

本試験の主比較はFull対No-interactionとする。No-memoryとRuleはsecondary mechanism controlsであり、primary failureを救済しない。role label removal、prompt paraphrase、network topology/Seed、別model/quantizationは事前登録したrobustness checkとする。条件間でactor出力を共有してはならないが、同じ`replicateId`のinitialization、network、schedule、inference seed manifestは一致させる。

### 11.5 再現性と保存範囲

実験manifestへ最低限、次を固定する。

- experiment ID、hypothesis、primary/secondary metrics、condition、actor数、tick数、replicate数
- Ollama version、model tag＋digest、quantization、context length、GPU offload状態
- actor/system prompt、observation template、bounded-memory規則、action JSON Schemaのversion/hash
- temperature、top-k、top-p、seed、最大出力token、scheduler、競合解決規則
- 初期人口、network、world、shock、全ての非LLM Seed
- 完了・失敗・timeout・schema棄却・再試行の規則と件数

immutable event logには各tickの公開/私的観測、検索されたmemory ID、LLMへ渡したversioned input、**最終の構造化応答**、validation結果、適用したstate diffを保存する。chain-of-thought、hidden reasoning、Ollama `thinking`は要求せず、受信した場合も保存・表示・評価へ渡さない。完全再演には保存済み最終応答をreplayし、engine再現性とLLM生成変動を分離する。

### 11.6 ローカル資源と段階

RTX 5060 Ti 16GBでは、modelを1つだけロードしてactorを逐次推論し、Ollama parallelismを1から開始する。現在の候補は[Ollama libraryのQwen 3.5](https://ollama.com/library/qwen3.5/tags)の9B Q4であるが、model license、digest、完全GPU offload、context別のVRAMをローカルsmokeで確認するまで確定しない。

段階的な上限案は次のとおりであり、統計的十分性やwall-clockの保証ではない。

| 段階 | actor × tick × condition × replicate | 目的 | gate |
|---|---:|---|---|
| Smoke | 4 × 8 × 2 × 1 | API、schema、event replay、GPU計測 | 失敗なく完走し、100% GPU offloadとログ欠落なしを人が確認 |
| Pilot | 8 × 24 × 4 × 3 | 分散、効果量、失敗率、prompt誘導を推定 | primary metricと本試験replicate数を凍結する人間承認 |
| Confirmatory候補 | 12 × 48 × 2 × 10 | Full対No-interaction | pilotからpower/precisionを再計算し、GPU時間・保存量を承認後に実行 |

Ollamaは24GiB未満で既定contextが小さく、agent用途には長いcontextを推奨しているため、[context length公式資料](https://docs.ollama.com/context-length)に従い8K/16K/32K/64Kをsmokeし、`ollama ps`でGPU常駐を確認する。長期memoryはアプリ側retrievalで圧縮するが、context短縮による行動品質低下は人間レビュー対象とする。APIが返すprompt/eval token数とdurationで実測し、根拠のないwall-clock見積りを公開しない。

### 11.7 妥当性限界と停止条件

[PNASの一次研究](https://doi.org/10.1073/pnas.2501660122)は、単純な戦略ゲームでも多くのLLMが人間の行動分布を再現できず、言語、役割、安全調整等で失敗が不規則に変わることを示した。一方、[1,052人をself-reportでgroundingした研究](https://arxiv.org/abs/2411.10109)は、詳細な面接・surveyに基づくagentでは特定のheld-out課題を一定程度予測できると報告している。後者はAgent World v1の短いtyped stateを対象人口の代理にできる証拠ではない。

したがってAgent Worldは、仮説生成、機構比較、stress testに採用し、実在個人の複製、母集団標本、政策予測、価値判断の代替には採用しない。v1 actorは人名や人口属性personaを持たず、紙/電子適性、adaptability、social susceptibility、resource constraint等の合成typed stateだけを持つ。同一model由来actorの相関、学習データ汚染、prompt/role-label誘導、安全調整、hallucination、memory poisoning、少数actorによるnetwork指標の不安定さを残余リスクとして報告する。

schema違反・timeout・GPU fallbackが事前閾値を超えた、条件間でprompt以外の実装差が見つかった、event replayが一致しない、primary metric定義を実行後に変更する必要が生じた場合は本試験を停止し、結果を探索的pilotへ降格する。
