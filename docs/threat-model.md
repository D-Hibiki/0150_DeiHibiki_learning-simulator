# 脅威モデル

## 対象と前提

対象は、ブラウザー内で動くReact UI、モデルv1、Web Worker、JSON/CSV/印刷出力、Sites向け静的配信Workerです。現在、認証、データベース、外部API、分析SDK、サーバー保存、ブラウザー永続化はありません。人や組織から収集した実測データを扱わず、合成データだけを生成します。

Agent Worldは別のローカル実験境界です。ローカルorchestrator、Ollama loopback API、model cache、実験manifest、actor memory、event log、集計artifactを対象に含めますが、公開SitesへAgent World機能やOllama接続を追加しません。v0.1 core/metricsとlocal Ollama runnerは実装・smoke済みですが、confirmatory実験は未承認です。

Sitesはprivate-by-defaultでデプロイします。公開範囲の拡大は別承認とし、配信基盤自体の内部実装と管理者アカウントはこのリポジトリの直接管理外です。

## 保護対象

- モデル式、入力、Seed、PRNG、結果の再現性と完全性
- 同一試行内のpaired comparisonと、反復間のストリーム分離
- 前回完了結果と未完了・中止結果の明確な区別
- レポートの設定、来歴、限界、数値の一貫性
- ブラウザーの可用性と応答性
- ビルド済み静的アセットと、デプロイ対象Sites versionの同一性
- privateデプロイのアクセス境界

## 信頼境界とデータフロー

| 境界 | 入力 | 制御 |
|---|---|---|
| 利用者 → React UI | 数値・選択入力 | HTML制約、実行前の`validateConfig`、stale表示 |
| メインスレッド → Web Worker | `SimulationConfig` | 構造化clone、Worker内の再検証、固定message type |
| Web Worker → メインスレッド | 進捗、完了結果、エラー | 同一オリジンのバンドルWorker、状態別処理、中止時terminate |
| `ExperimentResult` → レポート | 集計済み合成結果 | 型付きSSOT、固定schema、固定ラベル |
| レポート → 端末 | Blob URL、印刷 | 利用者の明示操作、固定文字列と数値由来のファイル名 |
| Sites Worker → ブラウザー | 静的アセット | GET/HEAD HTMLだけSPA fallback、API/書き込み要求はfallbackしない |
| 運用者 → Sites | version保存・デプロイ・公開範囲 | private-by-default、操作ごとの承認、以前の保存済みversionへrollback |
| ローカルorchestrator → Ollama | versioned prompt、局所観測、検索済みmemory、action schema | loopback限定、固定model digest、timeout、出力上限、parallelism制限 |
| 開発Web server → local agent server | `/api/agent-world/**` proxy | Web server自体もloopback限定。LAN/public bindではAgent Worldを有効にしない |
| actor最終応答 → world engine | schema付きaction、観測可能なmessage | strict schema、allowlist、範囲・権限・state precondition検証 |
| world engine → event log | 観測、最終action、validation、state diff | append-only、experiment/replicate/tick/actor ID、CoT非保存 |
| Agent World artifact → 外部共有 | manifest、event log、集計 | 実験実行と分離した人間承認。既定はローカルのみ |

## 想定する攻撃者・誤用

- 公開ページへ到達でき、入力値やURLを操作する一般利用者
- 共有端末上で、別の利用者の画面や明示保存ファイルを閲覧できる人物
- 依存関係や配布経路を侵害する第三者
- 誤ったversionまたは公開範囲を選ぶ運用者
- 合成結果を実測社会調査や因果的証拠として誤読・転載する利用者

## 脅威と対策

### 不正入力による計算破損

数値範囲外、非整数、構成比不整合、大きすぎる反復で計算や結果を壊す可能性があります。モデル実行前とWorker内で設定を検証し、学習者数と反復数を固定上限へ制限します。UIの`valid`判定は操作性の補助であり、`validateConfig`を真正な境界とします。

### 計算負荷によるブラウザー停止

最大設定では計算量と配列sortが増えます。計算をWeb Workerへ分離してUIスレッドを保護し、進捗と中止を提供します。これは同一利用者が自分の端末で起こす負荷を緩和するもので、共有計算資源へのリモートDoS境界は現在ありません。

### 中止・例外後の誤表示

部分結果を完了結果として解釈すると意思決定を誤ります。Workerは完了時だけ結果を返し、中止時はterminateして前回完了結果を保持し、エラーを表示します。進捗状態と結果状態を分けます。

### XSS・動的コード実行

現在の入力は数値・選択値で、Reactのテキスト描画を使用します。任意HTML挿入、`eval`、動的関数生成、外部HTML取込はありません。今後自由記述、URL取込、外部データを追加する場合は、出力contextごとのencodingと入力制約を再設計します。

### CSV/ファイル出力の悪用

CSV数式注入や危険なファイル名が考えられます。現行CSVは固定ラベルと数値・モデルメタデータのみで、利用者の自由入力文字列を含みません。ファイル名も固定prefixとunsigned 32-bit Seedから構成します。将来自由記述を出力する場合は、表計算ソフト向けformula injection対策が必要です。

### 結果の外部送信・残留

アプリコードは結果を外部へ送信せず、localStorage/sessionStorageも使いません。設定と結果はページメモリに残り、リロードで消えます。明示的に保存したJSON/CSV/PDFは利用者端末に残るため、共有端末では利用者が削除・管理します。ホスティング基盤の通常アクセスログは別の運用・契約境界です。

### 依存関係・ビルドの改ざん

依存関係はlockfileで固定し、`npm ci`と`npm audit`を使用します。`npm run verify`で型、テスト、ビルド、Sites成果物を確認します。自動検査だけではレジストリや配信基盤の完全性を保証しないため、更新時に公式勧告と差分をレビューします。

### 誤デプロイ・過剰公開

誤ったversionやpublic設定は未レビューコードを外部公開します。Sitesデプロイはprivate-by-defaultとし、保存version、対象環境、アクセス範囲、rollback対象を操作前に提示して承認を得ます。公開範囲の拡大は別承認です。

### 合成結果の社会的誤解

最も重要なプロダクト上の害は、モデル内の値を実測の教育効果、因果効果、代表推計、予測として扱うことです。主要画面、レポート、JSON artifact、方法論で限界を明示し、`max`による併用方式の構造的優位を説明します。反復数を増やしても外的妥当性が高まらないことを表示します。

## Agent World固有の脅威と対策

### actor間prompt injectionとmemory poisoning

一方のactorが発話に命令、偽のsystem message、tool要求、過去の出来事の捏造を埋め込み、他actorのpolicyやmemoryを汚染できます。actorの発話は常に**simulation内のuntrusted observation**として区切り、system/policy/schemaより上位に解釈しません。memoryには発信actor、tick、visibility、world event ID、観測事実/actor主張の区別を付け、memory更新がactor主張をworld stateへ昇格しないようにします。

### 越権行動と状態改ざん

LLMが所持していない資源を移転する、見えない相手へ連絡する、未来のstateを書く可能性があります。actorは有限action schemaの提案だけを返し、world engineがactor ID、権限、資源、位置、対象、tick、preconditionを検証します。LLM textから直接state mutationを行いません。tool callingを使う場合もsimulation内のread-only queryまたはproposal toolだけに限定し、shell、filesystem、任意network、GitHub、Sites操作を登録しません。

### 私的知識・actor境界の漏えい

共有model process、prompt組み立て、log表示の誤りにより、別actorの非公開typed stateやmemoryが見える可能性があります。actor stateをID別に分離し、観測filterを決定論的に実装し、prompt snapshot testとcanary testを条件ごとに行います。集計・人間レビュー用artifactは必要最小限にredactし、実在個人データを入力しません。

### chain-of-thoughtと機微情報の過剰保存

Ollamaのthinking対応modelがhidden reasoningを返す場合があります。Agent Worldはthinkingを要求せず、受信しても永続化、UI表示、telemetry、評価入力、PR artifactへ含めません。保存対象はversioned input、最終構造化action、観測可能な発話、validation結果、state diffです。推論監査を理由にCoT保存へ切り替える場合は、別のprivacy/security承認と保存期間設計が必要です。

### ローカルAPIの意図しない公開

Ollamaを`0.0.0.0`やLANへbindしたり、許可originを広げたりすると、他プロセスやWebページからGPU資源・modelへ到達される可能性があります。[Ollama FAQ](https://docs.ollama.com/faq)にあるhost/origin設定を既定から拡張せず、loopbackだけを許可します。SitesやブラウザーbundleへOllama URLを埋め込みません。ネットワーク公開が必要になった場合はAgent World local-onlyの範囲外として設計を停止します。

agent serverだけがloopbackでも、LANへbindした開発Web serverがAgent APIをproxyすれば境界を迂回できます。この実装blockerは、proxyを`--mode agent --host 127.0.0.1`のときだけ有効にし、通常のVite/Sitesから除外して解消しました。Web server、agent server、Ollamaの全hopをloopbackに固定した状態を継続し、別端末からの到達不能は環境ごとに人が確認します。

### 失敗fallbackによる条件汚染

LLM timeout、HTTP error、schema rejectionをrule actionへsilent fallbackすると、Full/No-interaction/No-memory条件にRule policyが混ざり、failure率と処置差が隠れます。この実装blockerは、decision HTTP失敗をfallbackせずterminal errorとして伝播することで解消しました。失敗runをcompletedやno-cascadeへ変換しないことをrun contractとtestで維持します。

### 判定指標の事後選択

pilot結果を見てcascadeやpaired-riskの閾値を選び、その閾値を同じrunまたはconfirmatoryへ流用すると、見かけの創発を過大評価できます。UIのprimary判定は`metrics.assessEmergence`とODDのcontinuity cascade threshold／paired riskへ統一し、AUCをsecondaryへ限定しました。confirmatoryではpilot閾値・pilot runを流用せず、閾値、minimum pairs、除外・停止規則を事前凍結して別承認します。

### 資源枯渇とサービス不能

長いcontext、無制限出力、並列actor、再試行loopによりVRAM/RAM/diskを枯渇できます。context、最大出力、timeout、再試行、actor/tick/replicate、log容量をmanifestで上限化し、parallelism 1から開始します。OOM、CPU fallback、disk下限、schema failure率を停止条件にし、部分runを完了扱いしません。

### model・prompt・評価器による系統誤差

同一modelでactorとjudgeを兼ねると、自然さや社会性を過大評価し得ます。primary metricはworld state/event logから決定論的に計算し、LLM judgeは副次評価に限定します。Full、No-interaction、No-memory、Rule (`rule-baseline`)をpaired比較し、prompt、model、quantization、languageの変更は別experiment versionとして扱います。

### model supply chainとライセンス

誤ったtag、更新されたtag、未確認license、改ざんmodelをpullする可能性があります。導入前にOllama公式libraryのtag、size、license、digestを記録し、run manifestはtagだけでなくdigestを固定します。model pullは外部通信・disk変更として事前承認し、既存cache削除は別の破壊的操作として扱います。

[OWASP LLM Prompt Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html)、[Ollama API](https://docs.ollama.com/api/chat)、[Ollama Structured Outputs](https://docs.ollama.com/capabilities/structured-outputs)を実装時の最低参照とします。ただしschema準拠は意味的妥当性や権限制御の代替ではありません。

## 残余リスクと対象外

- モデルの社会科学的妥当性と説明の理解度は自動テストできない
- Sitesの実際のアクセス制御、レスポンスヘッダー、基盤ログはデプロイ後に確認が必要
- OSのネイティブ保存ダイアログと保存後ファイルの扱いはブラウザー外の境界
- 共有端末で利用者が保存したファイルを別の利用者が読むリスク
- 依存関係、ブラウザー、ホスティング基盤の未知の脆弱性
- 現在は個人データを扱わないため、人を対象とする研究の安全・倫理統制は実装していない
- Agent Worldのtyped actor state/role labelの妥当性、創発の非誘導性、現実集団への一般化は自動テストできない
- Ollama/model/GPU組合せによる完全なbitwise再現性と長期run時間は、短いcompatibility/citizen/browser smoke後も不明
- 同一基盤modelから生成するactor群には共通biasと相関が残る

## 検証と再評価トリガー

次の場合は本書を更新し、`npm run verify`、依存関係監査、手動レビューを再実施します。

- 認証、API、データベース、分析、永続化、外部送信を追加する
- 自由記述、URL、アップロード、実測データを取り込む
- Worker message、レポートschema、乱数生成、統計式を変更する
- Sites binding、配信Worker、公開範囲、セキュリティヘッダーを変更する
- 重大な依存関係勧告またはセキュリティ報告を受ける
- Agent Worldのmodel、prompt、memory、action schema、scheduler、tool、Ollama host/originを変更する
- Agent World artifactを端末外へ共有する、実在個人データを入力する、またはSitesへAgent機能を追加する
