# 運用

## 現在の運用状態

- environment: ローカル開発・検証済み。Sitesデプロイは保留中
- deployment visibility: 初回はprivate-by-default。public化は別承認
- data: 合成データのみ。認証、データベース、API、分析、永続化なし
- primary verification: `npm run verify`
- owner / incident contact: GitHubリポジトリ作成時に所有者と非公開連絡先を確定する
- known limitations: 合成モデルであり、実測の社会調査、因果推論、母集団推定、将来予測ではない

## 環境と段階

| 段階 | 目的 | 外部状態への影響 | 承認点 |
|---|---|---|---|
| ローカル | 開発、テスト、目視確認 | 依存関係、`dist`、明示保存したレポートを端末に作成 | 実装者が検証結果を記録 |
| Sites private | 実URLでの共有レビュー | Sites version保存とprivate deployment | 対象version、アクセス範囲、rollbackを人が承認 |
| 公開 | 一般アクセス | 公開範囲を拡大 | private previewの目視後に別の人間承認 |

現在はローカル段階です。private Sites versionの保存・デプロイと、public化はまだ実施していません。

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

alert delivery proofは未取得です。監視サービスを追加する場合は、外部送信とプライバシー境界が変わるため、実装前に承認と脅威モデル更新が必要です。

## 障害対応

次の場合は新規デプロイと公開範囲の拡大を停止します。

- `npm run verify`、package作成、version保存、デプロイが失敗した
- deployment statusが不明または長時間進行中
- private access、レスポンスヘッダー、実URL smokeが期待と異なる
- 結果、Seed、レポートの再現性に不整合がある
- 依存関係の重大な脆弱性またはセキュリティ報告がある

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

## 再検証トリガー

- source、dependency、lockfile、model version、report schemaの変更
- Worker、Sites packaging、静的配信Worker、hosting bindingの変更
- 認証、API、分析、データベース、永続化、外部送信の追加
- 公開範囲またはドメインの変更
- セキュリティ勧告、インシデント、ブラウザー互換性問題
- 既存の運用証拠が担当者の定めた有効期限を超えた場合
