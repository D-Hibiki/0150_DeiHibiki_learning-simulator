# 学習インフラ冗長性シミュレーター

紙のみ・電子のみ・紙＋電子という3つの学習インフラを、同じ仮想学習者集団で比較するブラウザーアプリです。複数の合成コホートを反復し、到達率、脱落率、下位20%平均、方式間差、累積平均の推移を表示・出力します。

> このアプリは、設定した数式と合成した仮想学習者に条件づけた計算実験です。人間から回答を収集した社会調査ではなく、現実の教育効果、因果効果、将来値、母集団代表性を示しません。

## 2つのモデル系統

- **Model v1**: 現在実装済みのブラウザー内Monte Carloシミュレーターです。このREADMEの「できること」と実行commandはModel v1を指します。
- **Agent World**: 社会構成員を独立したLLM actorとしてローカルで動かし、相互作用由来の集団パターンを対照・ablationで探索する別モデルです。v0.1の決定論的core/metricsは`src/agent-world/`、local runnerは`local/`に分離しています。loopback、失敗処理、ODD準拠判定の実装blockerは解消し、ローカルsmokeまで確認済みですが、これは探索的pilotの準備証拠です。別承認なしにconfirmatory実験へ使用せず、Model v1の結果schemaへ混ぜません。

Agent WorldはローカルorchestratorからloopbackのOllamaだけを利用します。公開SitesではAgent Worldを無効にし、Sitesやブラウザーから利用者端末のOllamaへ接続しません。chain-of-thought、hidden reasoning、Ollama `thinking`は保存・表示せず、監査には最終の構造化行動、観測可能な発話、validation、world state差分を使います。

## 目的

急激な社会変化に備えて複数の学習手段を残すという仮説を、前提と限界を明示した再現可能な合成シミュレーションとして比較・検討できるようにします。

## できること

- 平常時、停電、急激な情報更新のシナリオ比較
- 学習者構成、成功閾値、媒体の利用可能率・教材鮮度の調整
- 1、10、100、1,000回の再現可能な反復試行
- 同一試行内で同じ合成コホートを使う paired comparison
- 到達率、脱落率、下位20%平均、中央95%試行範囲の表示
- 反復回数に対する累積平均の推移表示
- JSON、集計CSV、試行CSV、印刷/PDF用レポートの生成
- 電子利用可能率と紙教材鮮度の感度分析プリセット

モデルv1では、紙＋電子のスコアを `max(紙スコア, 電子スコア)` と定義します。このため、併用方式が各単独方式以上になることは社会的発見ではなく数式上の帰結です。

## データとプライバシー

アプリには認証、データベース、外部API、分析SDK、サーバー保存、ブラウザー永続化がありません。設定と結果は実行中のブラウザー内メモリにだけ保持されます。JSON/CSVを選んだ場合は利用者の端末へローカルファイルとして保存されます。

アプリのコードは設定や結果を外部へ送信しません。公開後のホスティング基盤では、通常の静的アセット要求に伴うアクセス情報が基盤側で扱われる可能性があるため、公開時にSites側の仕様と設定を別途確認します。

Agent World v1は人名や人口属性personaを使わず、合成した行動関連のtyped stateとローカルartifactだけを扱います。実在個人・未成年者・学校や組織の機微情報は入力しません。Ollama modelのpullは外部通信とローカルcache変更、実験はGPU時間とdisk消費、artifactのGit/Issue/PR/Sites掲載は外部共有として、それぞれ実行前に対象と影響を確認します。

## クイックスタート

依存関係をロックファイルどおりに導入します。

```powershell
npm ci
npm run dev
```

Viteが表示したローカルURLをブラウザーで開きます。

Agent World runnerの実装確認用commandは次です。Ollamaと許可modelが既にローカル導入済みであることを前提とし、model pullは別承認です。

```powershell
npm run agent:compat
npm run agent:citizen-smoke
npm run dev:local
```

`agent:compat`はOllama OpenAI互換APIとAgents SDKの最小compatibility smoke、`agent:citizen-smoke`は1 actorの実decision、`dev:local`はWeb UIとloopback agent serverの開発起動です。Ollama 0.32.14、`qwen3.5:9b-q4_K_M`でcompatibility pass、citizen smoke 2.25秒、ブラウザーのstart/progress/cancelを確認済みです。これらは実装とpilot準備の証拠であり、confirmatory研究結果ではありません。

既知だった3つの実装blockerは解消済みです。Vite proxyは`--mode agent --host 127.0.0.1`のときだけ有効、decision HTTP失敗はfallbackせずterminal error、UI判定は`metrics.assessEmergence`とODDのcontinuity cascade threshold／paired riskへ統一し、AUCはsecondary表示だけにしました。ただしpilotで選択・調整した閾値や結果をconfirmatoryへ流用してはいけません。confirmatoryは閾値、minimum pairs、model digest、prompt/schema、Seed、除外・停止規則を事前凍結し、pilot runを除外したうえで別の人間承認を必要とします。詳細は[アーキテクチャ](docs/architecture.md)と[運用手順](OPERATIONS.md)を参照してください。

## 検証

主要な検証コマンドは次です。

```powershell
npm run verify
```

このコマンドは、型検査、Vitest、プロダクションビルド、Sites Worker契約テストを順に実行します。個別には次を使用できます。

```powershell
npm run typecheck
npm run test
npm run build
npm run test:sites
```

自動テストでは、再現性、乱数系列のprefix安定性、最大剰余法、下位20%の切り上げ、`max`規則、paired差、統計集計、CSV/JSONの構造、Sites向け成果物を確認します。

次は人による確認が必要です。

- 実ブラウザーでのJSON/CSVネイティブ保存
- デスクトップおよびモバイルの目視レビュー
- 注意書きの明瞭さと社会科学的な解釈の妥当性
- 公開環境のアクセス制御、レスポンスヘッダー、実URLでのsmoke test
- Agent Worldのcascadeがpromptやrole labelで誘導されていないこと、社会的解釈の妥当性
- Agent Worldの完全GPU offload、長時間runの安定性、別model/promptでの頑健性
- Agent World event logにchain-of-thought、`thinking`、別actorのprivate memoryがないこと

## ビルドとホスティング

```powershell
npm run build
```

ビルドは次のSites向け成果物を生成します。

- `dist/client/index.html`
- `dist/server/index.js`
- `dist/.openai/hosting.json`

Sitesへのデプロイは保留中です。初回共有はprivateを既定とし、保存したSite versionを明示的にデプロイします。問題時のロールバックは、直前の既知正常な保存済みSites versionを再デプロイして行います。詳しくは [OPERATIONS.md](OPERATIONS.md) を参照してください。

## 設計資料

- [方法論](docs/METHODOLOGY.md)
- [アーキテクチャ](docs/architecture.md)
- [脅威モデル](docs/threat-model.md)
- [Agent World ODD仕様](docs/agent-world-odd.md)
- [デザインQA](design-qa.md)
- [セキュリティ方針](SECURITY.md)
- [貢献手順](CONTRIBUTING.md)
- [運用手順](OPERATIONS.md)

## モデルの適用限界

反復回数を増やすと、固定したモデル内のモンテカルロ誤差は小さくなります。一方で、入力分布、変数間の関係、乗算式、`max`規則、欠落変数、現実への適合性に関する不確実性は減りません。現実の政策判断や教育効果の根拠として単独利用しないでください。外的妥当性を論じるには、別途、研究計画、倫理・同意、標本設計、妥当な測定、実測データによる校正、独立データによる外部検証が必要です。

## 現在の状態

- モデル: v1.0.0
- 実装形態: React + TypeScript + Vite、Web Workerによる計算
- Agent World: v0.1 core/metrics＋local runner。実Ollamaでcompatibility/citizen/browser smoke済み、confirmatoryは未承認、Sitesでは無効
- 保存: ブラウザー内メモリと利用者が明示的に保存するローカルファイルのみ
- Sitesデプロイ: 保留中、private-by-default
- 公開判断: 自動検証に加えて人間による承認が必要
