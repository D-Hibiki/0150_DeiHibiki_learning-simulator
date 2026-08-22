# 運用

## 現在の運用状態

- environment: ローカル開発・検証済み。Sitesデプロイは保留中
- deployment visibility: 初回はprivate-by-default。public化は別承認
- data: 合成データのみ。認証、データベース、API、分析、永続化なし
- primary verification: `npm run verify`
- owner / incident contact: GitHubリポジトリ作成時に所有者と非公開連絡先を確定する
- known limitations: 合成モデルであり、実測の社会調査、因果推論、母集団推定、将来予測ではない
- agent world: v0.1 core/metricsとlocal runnerを分離。loopback/failure/ODD判定blockerは解消しローカルsmoke済み、confirmatoryは未承認、Sitesでは常に無効

## 環境と段階

| 段階 | 目的 | 外部状態への影響 | 承認点 |
|---|---|---|---|
| ローカル | 開発、テスト、目視確認 | 依存関係、`dist`、明示保存したレポートを端末に作成 | 実装者が検証結果を記録 |
| Agent World smoke | loopback Ollama、schema、event replay、GPU常駐の確認 | model pull/cache、manifest、event log、GPU時間を端末に作成・消費 | model tag/digest/license/容量、上限、CoT非保存を運用者が承認 |
| Agent World pilot | control/ablation、効果量、失敗率の探索 | 複数runのローカルartifactとGPU時間 | 方法論reviewerがprimary metric、本試験設計、外部共有可否を承認 |
| Agent World confirmatory | 凍結したFull対No-interaction比較 | 長時間GPU利用とローカルartifact | pilot証拠、precision/power、停止条件、保存量を別承認 |
| Sites private | 実URLでの共有レビュー | Sites version保存とprivate deployment | 対象version、アクセス範囲、rollbackを人が承認 |
| 公開 | 一般アクセス | 公開範囲を拡大 | private previewの目視後に別の人間承認 |

現在はModel v1のローカル段階です。Agent Worldのcore/metricsとlocal runnerは実装され、実Ollamaでローカルsmoke済みですが、confirmatory実験可能とは扱いません。private Sites versionの保存・デプロイとpublic化もまだ実施していません。Sitesでは説明用のdisabled画面を表示しても、Agent World実行endpoint、Ollama接続、log取得、実行可能controlを提供しません。

## SSOT、担当、承認

| 対象 | SSOT | 実行担当 | 必須承認 |
|---|---|---|---|
| Model v1 | model code、`SimulationConfig`、`ExperimentResult` | 実装者 | 現在HEADのverifyと人間のvisual/method review |
| Agent Worldモデル | `docs/agent-world-odd.md`、versioned experiment manifest、world engine | simulation実装者 | 方法論ownerがODD、control、metrics、停止条件を承認 |
| Agent World run | immutable event log、保存済み最終応答、state diff、集計artifact | ローカル運用者 | model/GPU予算、実在データ不使用、CoT非保存をrun前承認 |
| Security | `SECURITY.md`、`docs/threat-model.md` | security reviewer | Ollama loopback、tool allowlist、情報境界をsmoke前承認 |
| Sites | source commit、保存済みSites version、deployment ID | release operator | private deployとpublic化をそれぞれ別承認 |

同一人物が複数担当を兼ねてもよいですが、confirmatory結果の解釈とpublic化は実装者だけで完結させません。自動test passは、研究設計、model pull、長時間run、外部共有、デプロイ、public化の承認を代替しません。

## インストールとビルド

```powershell
npm ci
npm run build
```

ビルド成功時に次が存在することを確認します。

- `dist/client/index.html`
- `dist/server/index.js`
- `dist/.openai/hosting.json`

## 自動検証

現在のソースとlockfileに対する主要チェックは次です。

```powershell
npm run verify
```

このコマンドは型検査、Vitest、プロダクションビルド、Sites Worker契約テストを順に実行します。依存関係変更時は追加で次を実行します。

```powershell
npm audit
```

`npm run verify`の成功は、現在のローカル自動検査の結果であり、公開承認、外的妥当性、実環境のセキュリティ保証ではありません。

## ローカルsmoke

1. `npm run dev`でローカルサーバーを起動する。
2. 平常、停電、急激な情報更新を順に選ぶ。
3. 1、10、100、1,000試行の代表ケースを実行し、進捗、完了、再現性を確認する。
4. 実行中止後に前回完了結果が残り、中止結果が完了扱いされないことを確認する。
5. 方式比較、反復レポート、感度分析の各タブを確認する。
6. ブラウザーコンソールのエラーと警告を確認する。
7. デスクトップとモバイルで主要操作とpage-level horizontal overflowを確認する。

## Agent Worldローカル運用

本節はAgent World local runnerのrun contractです。`npm run agent:compat`はAgents SDK＋Ollamaの最小compatibility、`npm run agent:citizen-smoke`は1 actorの実decision、`npm run dev:local`はUI＋agent serverの開発起動です。

### 解消済みblockerと実測証拠

- Vite proxyは`--mode agent --host 127.0.0.1`のときだけ有効で、通常のVite/SitesはAgent API proxyを持ちません。
- decision HTTP失敗はrule policyへfallbackせずterminal errorになり、失敗runをcompletedへ変換しません。
- UIのprimary判定は`metrics.assessEmergence`に集約し、ODDのcontinuity cascade thresholdとpaired risk comparisonを使います。AUCはsecondary visualizationだけです。
- Ollama 0.32.14、`qwen3.5:9b-q4_K_M`で`npm run agent:compat`がpassしました。
- 同じ環境で`npm run agent:citizen-smoke`が2.25秒でpassし、ブラウザーでstart/progress/cancelを確認しました。

この証拠はtransport、1 actor decision、UI制御経路と3 blockerの解消を示しますが、長時間安定性、外的妥当性、confirmatory研究結果は保証しません。

### confirmatoryの別承認

pilotで選択・調整した閾値、効果量、結果、runをconfirmatoryへ流用しません。confirmatory用にcascade/paired-risk threshold、minimum completed pairs、model tag/digest、prompt/action schema、protocol/engine hash、Seed manifest、反復数、除外・停止規則、precision/power、disk/GPU予算を事前凍結します。pilot runをconfirmatory datasetから除外し、方法論・security・operations ownerが凍結manifestを別承認してから新規runを開始します。

### preflight

1. Model v1とAgent Worldのどちらを実行するかを記録し、schemaと出力先を分ける。
2. Ollama、agent server、Agent WorldをproxyするWeb serverが全てloopbackだけでlistenし、SitesやLANから到達できないことを確認する。
3. `@openai/agents`を使う場合はremote tracingをrun前に無効化し、OpenAI API key、trace exporter、remote MCP/hosted toolが未設定であることを確認する。
4. Ollama version、model tag/digest、quantization、license、disk容量を記録する。未取得modelのpullは外部通信とlocal cache変更を提示して承認を得る。
5. manifestのactor、tick、condition、replicate、context、output token、timeout、retry、parallelism、disk上限、停止条件を確認する。
6. prompt、bounded-memory規則、action schema、world engine、metricsのversion/hashを固定する。
7. typed actor state、prompt、memoryに人名、人口属性persona、実在個人・未成年者・学校/組織の機微情報がないことを人が確認する。
8. chain-of-thought、hidden reasoning、Ollama `thinking`を要求・保存・表示しない設定とlog testを確認する。
9. packet/HTTP logまたは同等の証拠で、Ollama loopback以外へのrequestがないことを確認する。
10. decision失敗、timeout、schema rejectionがterminal failureになり、rule fallbackや部分completedへ変換されないことを確認する。
11. model-backed APIへのPOSTがexact local Originだけを受理し、missing/null/mismatched Originを拒否するcontract testを確認する。
12. artifactのinference requestごとのSeed、model digest、prompt/action-schema/engine version、generation optionが実際のOllama requestと一致することを確認する。
13. Seed manifestがinitialization/network/schedule/inferenceの4 streamと完全一致し、replayが保存済みnetworkを使用することを確認する。

### smokeからconfirmatoryまで

- Smokeは4 actor × 8 tick × 2 condition × 1 replicateを上限候補とし、schema、timeout、event replay、100% GPU offload、log完全性を確認する。
- Pilotは8 × 24 × 4 × 3を上限候補とし、Full、No-interaction、No-memory、Rule (`rule-baseline`)の分散、失敗率、prompt誘導を調べる。
- Confirmatory候補は12 × 48 × 2 × 10だが、pilotの効果量/分散、必要precision、wall-clock、保存量から再承認する。数値は統計的十分性の保証ではない。
- actor推論は逐次、world更新は同じ`state_t`からの二相tickとする。parallelismは1から開始する。
- contextは8K/16K/32K/64Kをsmokeし、`ollama ps`とAPIのtoken/durationで実測する。CPU fallback、OOM、disk下限、schema failure率超過、replay不一致で停止する。
- 中止・失敗runを完了runへ混ぜない。事後にprimary metric、除外規則、conditionを変更したrunは探索的pilotへ降格する。

### 保存と後片付け

保存するのはmanifest、観測、検索memory ID、versioned input、最終構造化action、観測可能なmessage、validation、state diff、決定論的集計です。chain-of-thoughtと`thinking`は保存しません。

model cache、event log、artifactは自動削除しません。容量削減や研究データ削除は、対象絶対path、experiment ID、保持すべき証拠、復旧可否を提示した別の破壊的操作です。Git/Issue/PR/Sitesへartifactを載せる場合も外部共有を別承認します。

## 人間による必須確認

自動テストでは次を保証できません。private previewを承認する担当者が確認します。

- 実ブラウザーでJSON、集計CSV、試行CSVがネイティブ保存できる
- CSVの文字化け、列ずれ、数値欠落がない
- 印刷/PDFの改ページと注意書きが読める
- 選択デザインに対するデスクトップ・モバイルの目視品質
- 合成モデルであり社会調査・因果推論・予測ではない説明が明瞭
- 実URLのアクセス制御がprivateで、未承認者が閲覧できない
- CSP等のレスポンスヘッダーと静的アセットのcontent type/cache挙動
- 本番URLのSPA fallbackと、API形式・POST要求がアプリシェルへ誤変換されない
- Agent WorldがSites bundleと公開画面に存在せず、ブラウザーからlocalhost:11434等へ接続しない
- Agent Worldのtyped actor stateとrole labelによるprompt誘導の有無、cascade/創発の解釈
- condition-blind review、実在データとの外部validation、別model/promptでの頑健性
- Ollamaの完全GPU offload、wall-clock、fan/temperature、長時間runの端末安定性
- event logにchain-of-thought、`thinking`、別actorのprivate memoryが含まれないこと
- Agents SDK tracingが無効で、OpenAI、remote MCP、任意外部hostへのrequestがないこと

## Sites private deployment

実行前に、対象プロジェクト、source commit、保存するversion、private visibility、外部影響、rollback対象を提示して承認を得ます。

1. `npm run verify`が現在のsource commitで成功していることを確認する。
2. 同じsource commitからSites packageを作成する。
3. 新しいSite versionを保存し、version identifierを運用記録へ残す。
4. privateとしてデプロイする。
5. デプロイ状態が完了するまで確認する。timeoutは失敗と断定せず、状態を再照会する。
6. 実URLを開き、ローカルsmokeと人間確認項目を実施する。
7. 承認されるまでpublicへ変更しない。

## 監視とアラート

現在、アプリ独自のanalytics、monitoring、alert deliveryはありません。private deployment後は、少なくとも次を運用者が定期またはリリースごとに確認します。

- Sitesのdeployment status
- トップページと静的アセットの到達性
- ブラウザーコンソールエラー
- private accessの維持
- GitHub上の依存関係勧告とCI結果（導入後）

Agent Worldは外部monitoringへ接続しません。ローカルrunではAPIのprompt/eval token数・duration、GPU/CPU offload、OOM、timeout、schema rejection、retry、disk残量、event replay結果を運用者が確認します。alert deliveryは実装しない限り保証しません。

alert delivery proofは未取得です。監視サービスを追加する場合は、外部送信とプライバシー境界が変わるため、実装前に承認と脅威モデル更新が必要です。

## 障害対応

次の場合は新規デプロイと公開範囲の拡大を停止します。

- `npm run verify`、package作成、version保存、デプロイが失敗した
- deployment statusが不明または長時間進行中
- private access、レスポンスヘッダー、実URL smokeが期待と異なる
- 結果、Seed、レポートの再現性に不整合がある
- 依存関係の重大な脆弱性またはセキュリティ報告がある
- Ollamaがloopback外へ公開された、未許可toolが登録された、actor private stateが漏えいした
- chain-of-thought/`thinking`が保存された、event replayが一致しない、model digestがmanifestと異なる
- Agent WorldがSites成果物へ混入した、またはSites/ブラウザーからOllamaへの接続が検出された

前回のpassを流用せず、原因修正後の現在HEADで自動検証と必要な人間確認をやり直します。

## ロールバック

ロールバックは、直前の既知正常な保存済みSites versionを再デプロイして行います。ソースの作業ツリーだけを戻したり、未保存のローカルbuildを使ったりしません。

1. 現在の問題version、症状、時刻、アクセス範囲を記録する。
2. 直前にsmoke済みの保存済みSites version identifierを確認する。
3. 対象と外部影響を提示し、人間の承認を得る。
4. 以前のversionを同じprivate visibilityで再デプロイする。
5. deployment status、トップページ、主要操作、アクセス制御、ヘッダーを再確認する。
6. 原因、影響、修正版、再発防止を記録する。

公開前に一度、以前の保存済みversionへ戻してsmokeする復旧訓練を行います。Sites versionがまだ存在しないため、現時点ではrollback drillは未実施です。

## RTO / RPO

- RTO: 未確定。private preview後、担当者と復旧手順の所要時間を実測して決める
- RPO: サーバー保存データはない。source commit、lockfile、保存済みSites version、明示保存したレポートが復旧単位

RTO/RPOが未確定の間は、可用性保証のある本番サービスとして扱いません。

## 運用証拠

リリースごとに次を記録します。

- environment:
- source commit:
- saved Sites version:
- deployment identifier / visibility:
- smoke command / result / timestamp:
- monitor signal / alert delivery proof:
- human download / visual / header / access review:
- restore or rollback drill:
- RTO / RPO:
- owner / incident contact:
- evidence expiry / revalidation trigger:
- known limitations:

Agent World runでは追加で次を記録します。

- experiment / manifest ID:
- ODD / prompt / schema / engine version:
- Ollama version / model tag / digest / quantization:
- GPU offload / context / parallelism:
- actor / tick / condition / replicate:
- token / duration / disk / failure / retry evidence:
- event replay result:
- CoT / thinking absence check:
- control / ablation / primary metric freeze approval:
- external sharing status:

## 再検証トリガー

- source、dependency、lockfile、model version、report schemaの変更
- Worker、Sites packaging、静的配信Worker、hosting bindingの変更
- 認証、API、分析、データベース、永続化、外部送信の追加
- 公開範囲またはドメインの変更
- セキュリティ勧告、インシデント、ブラウザー互換性問題
- 既存の運用証拠が担当者の定めた有効期限を超えた場合
- Agent Worldのmodel、prompt、bounded-memory規則、action schema、world engine、scheduler、metric、上限を変更した場合
- Ollama host/origin、tool権限、artifact保存/共有範囲、実在データの扱いを変更する場合

## Agent World公式参照

- [Ollama Windows](https://docs.ollama.com/windows)
- [Ollama Chat APIとtoken/duration fields](https://docs.ollama.com/api/chat)
- [Ollama context length](https://docs.ollama.com/context-length)
- [Ollama FAQ: host、origin、parallelism、`ollama ps`](https://docs.ollama.com/faq)
- [Ollama Qwen 3.5 tags](https://ollama.com/library/qwen3.5/tags)
- [OpenAI Agents SDK code orchestration](https://openai.github.io/openai-agents-js/guides/multi-agent/)
- [OpenAI Agents SDK tracing](https://openai.github.io/openai-agents-js/guides/tracing/)
