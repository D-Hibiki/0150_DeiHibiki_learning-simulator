# Public repository readiness

この文書は、`D-Hibiki/learning-infrastructure-redundancy-simulator`をGitHubでPublicにする前後の検査記録です。Public化は閲覧範囲を広げますが、[LICENSE](LICENSE)に記載された利用許諾の範囲を変更しません。

## 判定

- 状態: 公開準備branchで確認中
- 検査日: 2026-08-25（Asia/Tokyo）
- 検査対象base: `main` / `f4f2d46fe8495fef7099a030563543d7bcd4a7a9`
- 対象repository: `D-Hibiki/learning-infrastructure-redundancy-simulator`
- 公開範囲: repositoryの全tracked file、全commit history、GitHub Actionsの公開情報、既存のPull Request
- ライセンス判断: All rights reservedを維持。MITその他のオープンソースライセンスへ変更しない

この文書を追加するcommitは上記baseより後になるため、Public化直前には新しい`main` HEAD、CI、検査結果を再測定します。

## ローカルで確認済み

- `README.md`に目的、実行環境、クイックスタート、制約、ライセンスと出典を記載
- `LICENSE`、`SECURITY.md`、`CONTRIBUTING.md`、`OPERATIONS.md`、`PREFLIGHT.md`、architecture、threat modelがGit管理下に存在
- repo-preflightのsecret候補検査: 0件
- repo-preflightの個人絶対path検査: 0件
- `npm audit --audit-level=high`: 既知の脆弱性0件
- GitHub Actions workflowは`contents: read`を基準とし、利用するGitHub Actionsをfull commit SHAで固定
- Git authorは`D-Hibiki`、merge committerはGitHub、依存更新はDependabot。既存履歴の作者・committerを書き換えない
- Agent WorldのOllama接続はlocal runnerからloopbackのみ。Sites buildはAgent Worldを無効化し、Ollamaへ接続しない
- 実在個人・学校・組織の調査データや外部データセットを収録せず、合成データだけを扱う

## GitHubで確認済み

- active GitHub CLI account、remote owner、push先は`D-Hibiki`で一致
- default branchは`main`
- 検査対象base `f4f2d46`のCIは成功
- Actionsのdefault workflow permissionsはread、workflowからのPull Request承認は無効
- 2026-08-25時点でDependabotのopen Pull Requestが7件あり、Public化と同時に閲覧可能になることをrepository ownerが了承

## Public化直前の停止条件

- 公開準備PRが未merge、または新しい`main` HEADでCIが失敗・未完了
- secret候補、個人path、未追跡の公開対象ファイル、意図しないauthorが見つかった
- GitHub CLI account、repository owner、remote、対象HEADのいずれかが不一致
- LICENSE、README、SECURITY、公開対象履歴の人間レビューが未完了
- `PRIVATE`から`PUBLIC`への正確なvisibility変更が、対象repositoryを明記して承認されていない

## Public化直後に実測する項目

以下はPublic化後のGitHub APIで確認し、設定変更は項目ごとに承認を得てから実行します。

- repository visibilityが`PUBLIC`であること
- 匿名アクセスでREADME、RESULTS、プレゼン資料、LICENSE、SECURITYが取得できること
- secret scanningとpush protectionの利用可否・現在値
- private vulnerability reportingの現在値
- Dependabot alerts、Code scanning、ruleset、branch protectionの利用可否・現在値
- default branch、Actions権限、open Pull Request数

## 保証しないこと

- 自動検査は未知の形式、暗号化・難読化された値、バイナリ内部を含むsecret不存在の完全保証ではありません。
- 合成シミュレーションは現実社会の因果効果、将来予測、母集団代表性を保証しません。
- Public GitHub repositoryとowner-onlyのSites deploymentは別の公開境界です。GitHubをPublicにしてもSitesのaccess policyは変更しません。
