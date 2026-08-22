# セキュリティ方針

## 対象

本方針は、学習インフラ冗長性シミュレーターの現在のソース、依存関係、ビルド成果物、Sites向け静的配信Workerと、ローカル限定Agent Worldのorchestrator、Ollama境界、model、prompt、actor memory、event logを対象とします。

現在のアプリには、認証、認可、データベース、外部API、分析SDK、サーバー側の業務処理、設定・結果の永続化はありません。利用者の入力と合成結果はブラウザー内メモリで処理され、明示的に選んだJSON/CSVだけが利用者の端末へ保存されます。

Agent Worldは別系統です。v0.1 core/metricsとlocal Ollama runnerは実装・smoke済みですが、confirmatory実験は未承認です。ローカルorchestratorからloopbackのOllama APIだけを利用し、Sites、公開ブラウザー、クラウドWorkerからOllamaへ接続しません。Sitesに説明用画面を含めても、実行endpointと実行可能controlは無効にします。Model v1とAgent Worldのschema、結果、妥当性の主張を分離します。

## 報告方法

脆弱性の可能性がある情報を公開Issueへ投稿しないでください。GitHubリポジトリのprivate vulnerability reportingまたはSecurity Advisoryが有効になった後は、その非公開窓口を使用してください。有効化前は、リポジトリ所有者が指定した非公開連絡先を使用してください。連絡先が確認できない場合は、再現手順や攻撃コードを公開せず、所有者へ非公開窓口の提示を依頼してください。

報告には、可能な範囲で次を含めてください。

- 影響を受けるversionまたはcommit
- 想定する影響と攻撃条件
- 最小限の再現手順
- ブラウザー、OS、配信環境
- 機密情報を除いたログや画面
- 提案する軽減策があればその内容

受領確認、修正予定、公開時期のSLAはまだ定義していません。外部公開前に所有者、連絡先、対応時間を確定します。

## セキュリティ境界

保護対象は次です。

- モデル式、Seed、入力、出力間の再現性と完全性
- ブラウザーの応答性と、実行中止後に未完了結果を完了扱いしないこと
- JSON/CSVレポートの内容と来歴
- 配信される静的アセットとSites versionの同一性

主な信頼境界は、フォーム入力から設定検証、メインスレッドからWeb Worker、Worker結果からUI、結果からBlobダウンロード、Sites Workerから静的アセット配信です。詳細は [docs/threat-model.md](docs/threat-model.md) を参照してください。

Agent Worldでは、ローカルorchestratorからOllama、局所観測からactor prompt、actor最終応答からworld engine、world transitionからappend-only event logも信頼境界になります。world engineだけを状態SSOTとし、LLMに直接状態変更や一般tool権限を与えません。

## 実装上の前提

- 数値入力はモデル実行前に範囲と整合性を検証します。
- 計算は同一オリジンのバンドル済みWeb Workerで実行します。
- 任意HTMLの挿入、動的コード評価、任意URLへの結果送信は行いません。
- 出力ファイル名は数値Seedと固定文字列から構成します。
- CSVに含める値は固定ラベルと数値・モデルメタデータであり、自由入力文字列を含めません。
- Sites Workerは静的アセットを返し、HTMLを要求するGET/HEADの不明パスだけを`index.html`へフォールバックします。API形式や書き込み要求をアプリシェルへ変換しません。
- Agent WorldはOllamaをloopback以外へbindせず、CORS/origin allowlistを公開Sitesへ広げません。
- Agent World APIをproxyする開発Web serverもloopback限定にします。agent serverだけを`127.0.0.1`へbindしても、`0.0.0.0`のWeb proxyがあればlocal-onlyとはみなしません。
- actor間messageとmemoryはuntrusted inputとして扱い、system instruction、action schema、actorの私的stateと分離します。
- actionはstrict schemaとworld-state preconditionをコードで検証し、shell、filesystem、任意network、GitHub、Sites toolをactorへ登録しません。
- chain-of-thought、hidden reasoning、Ollama `thinking`フィールドを要求・保存・表示・共有しません。監査には最終action、観測可能なmessage、validation、state diffを用います。
- `@openai/agents`を利用する場合は、最初のagent runより前にremote tracingを無効化します。OpenAI API key、trace exporter、remote MCP/hosted toolをAgent Worldへ設定せず、非loopback requestがないことをsmokeで確認します。

## 検証

変更前後に次を実行してください。

```powershell
npm ci
npm run verify
npm audit
```

自動検査が成功しても、公開可否の保証にはなりません。公開前には依存関係の勧告、ビルド成果物、アクセス制御、レスポンスヘッダー、実URL、ネイティブダウンロードを人が確認します。

Agent Worldの別test suiteでは、loopback限定、観測filter、actor間state分離、schema拒否、world precondition、timeout/retry上限、event replay、CoT非保存、Full/No-interaction条件の同一初期化を確認します。typed actor stateが人間を代表するか、prompt injectionを全て防げるか、集団パターンが誘導されていないか、現実への外的妥当性があるかは自動テストで保証できません。

## 秘密情報

このリポジトリへAPIキー、Sites credential、GitHub token、個人データをcommitしないでください。将来外部サービスを追加する場合は、クライアントへ秘密情報を埋め込まず、データフロー、保存期間、削除手順、最小権限、脅威モデルを更新してからレビューを受けてください。

ローカルOllamaは既定でAPI keyを必要としません。この事実を認証済みserviceと誤解せず、loopback境界を認可境界として保護します。実在個人、未成年者、学校・組織の機微情報をAgent Worldのtyped state、prompt、memory、logへ入力しません。model pull前にtag、digest、license、容量を確認し、pullとcache削除を別操作として扱います。

## 対応とロールバック

脆弱性が疑われる場合は、新規デプロイと公開範囲の拡大を停止します。修正版を検証して新しいSites versionとして保存・デプロイします。直ちに復旧が必要な場合は、既知正常な以前の保存済みSites versionを再デプロイします。復旧後も原因、影響範囲、公開設定、配信ヘッダー、依存関係を再確認します。

Agent Worldで境界逸脱、private memory漏えい、未許可tool、Ollamaの非loopback公開、CoT保存、再演不一致を検知した場合はrunを停止し、artifactの外部共有を凍結します。model processの停止やlog/model cacheの削除は破壊的操作なので、正確な対象を確認し、必要な証拠を保全してから人間承認の下で行います。

既知だった3つのsecurity/integrity blockerは解消済みです。Agent API proxyは`--mode agent --host 127.0.0.1`時だけ有効、decision HTTP失敗はfallbackせずterminal error、primary判定は`metrics.assessEmergence`とODDのcascade/paired-riskへ統一し、AUCはsecondaryだけです。Ollama 0.32.14、`qwen3.5:9b-q4_K_M`によるcompatibility/citizen smokeとブラウザー制御確認は、この境界の実装証拠です。

追加のgateway・完全性対策として、modelを呼ぶHTTP要求は`Origin: http://127.0.0.1:5173`の完全一致を必須とし、欠落・`null`・別originを拒否します。各decisionはworld、citizen、tickから導出した32-bit SeedをOllamaへ渡し、承認済みmodel digestを呼出し直前に再検証します。60秒deadline、context 4096、出力256 token、schema repair最大1回を固定し、cancel/timeoutの`AbortSignal`をOllama transportまで伝播します。Seed manifestは4つの既知streamだけを許可し、replayはartifactに保存したnetworkとaction logを入力に完全一致を検証します。

この解消はconfirmatory承認を意味しません。pilotで選択・調整した閾値、pilot結果、pilot runを本試験へ流用せず、protocol hash、model digest、prompt/schema、閾値、minimum pairs、Seed、除外・停止規則を事前凍結し、方法論・security・operationsの別承認を得ます。

## 公式参照

- [Ollama FAQ: host、origin、parallelism、local運用](https://docs.ollama.com/faq)
- [Ollama Chat API](https://docs.ollama.com/api/chat)
- [Ollama Structured Outputs](https://docs.ollama.com/capabilities/structured-outputs)
- [OWASP LLM Prompt Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html)
- [OpenAI Agents SDK model providers](https://openai.github.io/openai-agents-js/guides/models/)
- [OpenAI Agents SDK tracing](https://openai.github.io/openai-agents-js/guides/tracing/)
