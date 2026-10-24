# 依存関係更新・監査結果（2026-10-24）

## 対象と監査結果

- 対象: `tttol/about-me-infra`、基準コミット `1bb3f7c0033ff41c62975c4fdce80858d793a804`（`main`）。Next.js アプリ本体ではなく AWS CDK / TypeScript のリポジトリ。
- npm registry の既知 advisory に対して、lockfile に含まれる本番・開発依存を監査した。
- 更新前: **12 件**（critical 0 / high 8 / moderate 2 / low 2）。更新後と同じ npm 12.2.1・書き込み可能な cache で旧 lockfile を監査した確定値。これは npm の影響パッケージ単位の集計で、独立した脆弱性 12 件という意味ではない。`via` の advisory URL を重複除去すると 42 件。
- 更新後: **0 件**（全依存、`--omit=dev` の双方、正常終了）。例外指定・audit 無効化・強制的な major override は使用していない。
- 生の JSON: [更新前](npm-audit-before.json)、[更新後・全依存](npm-audit-after.json)、[更新後・本番依存](npm-audit-production-after.json)。更新前は npm 12.2.1 の `npm audit --package-lock-only --json`（終了コード 1）、更新後は同じ npm 12.2.1 の `npm audit --json` / `npm audit --omit=dev --json`（終了コード 0）を保存。

### 初回監査値の訂正

最初の npm 11.9.0 の出力は 80 件（high 22 / moderate 32 / low 26）だったが、既定 cache `~/.npm` が使用不能な環境だったため、この値を改善幅の基準には使わない。[初回 JSON](npm-audit-initial-cache-unavailable.json) は診断証跡としてのみ残す。書き込み可能な cache を指定した再実行では、**npm 11.9.0 と 12.2.1 の両方で 12 件**となった。旧 lockfile の SHA-256 はすべて `48d507f5b5b654eb26a6831cd10584897fb3e3e8e9dcd4d464c777c6df1aab61` で同一、直接 advisory URL 42 件も一致する。npm の packument 取得失敗時に空の versions として処理する実装から、初回は依存先へのメタ脆弱性判定が過大に波及したと考えられる（原因はこの検証に基づく推定）。最終的な比較は **12 → 0**。

## 更新内容

2026-10-24 に npm の stable `latest` を確認し、バージョンを固定、lockfile を再生成した。

| パッケージ / ツール | 更新前（lockfile） | 更新後 |
| --- | --- | --- |
| `aws-cdk-lib` | 2.187.0 | 2.274.0 |
| `aws-cdk` | 2.1006.0 | 2.1146.1 |
| `constructs` | 10.4.2 | 10.8.1 |
| `dotenv` | 16.4.7 | 18.0.9 |
| `typescript` | 5.6.3 | 7.0.2 |
| `@types/node` | 22.7.9 | 24.19.2 |
| Node.js | 指定なし | 24.22.1 LTS |
| npm | 指定なし | 12.2.1 |

- Node.js は CDK がサポートする最新 LTS の 24 系を採用。`@types/node` も実行環境に合わせた 24 系の最新 stable を使用し、26 系の API を誤って許可しない。
- 重複した `cdk` 2.1101.0 を削除し、公式 CLI の `aws-cdk` に統一。
- どこからも import されていない `zod` 3.24.2 を削除。必要のない脆弱な依存を残さない。
- Jest 29.7.0 / `@types/jest` 29.5.14 / ts-jest 29.3.0 / ts-node 10.9.2 を削除。既存テストは空の SQS サンプルのみで、最新 ts-jest 29.4.15 の TypeScript peer 範囲は `<7`。TypeScript 7 の事前コンパイルと Node 標準テストに移行し、互換性のない変換器を無理に使わない。
- `cdk.json` のアプリ起動を「build → `dist/bin/about-me-infra.js`」に変更。TypeScript 7 に対応する NodeNext 設定、`dist/` 出力へ整理。
- dotenv 18 のログを抑止し、オフライン検証時だけ空設定ファイルを明示できるようにした。通常は従来どおり `.env` を読む。
- `.nvmrc` / engines / packageManager で検証した環境を明示し、依存インストールの lifecycle scripts を実行せず検証する。

## 生成インフラの差分

旧・新双方を同じ架空の値（account `111111111111` / `us-east-1` / `example.com` / ダミー zone と証明書 ARN）で synth し、CloudFormation JSON 全体を再帰比較した。AWS への照会や実際のスタックとの `cdk diff` は行っていない。

**差分は次の 1 箇所のみ**（[機械可読の差分](cloudformation-template-diff.json)）:

```text
CustomS3AutoDeleteObjectsCustomResourceProviderHandler9D90184F
  Properties.Runtime: nodejs20.x -> nodejs24.x
```

これは CDK が生成する S3 自動削除プロバイダー Lambda の runtime 更新。実際のデプロイ時には Lambda の更新が発生するため、AWS 側での最終確認は別途必要。

- リソース数 **15 → 15**、すべての logical ID / resource type を保持。追加・削除なし。
- S3 名、暗号化、public access block、bucket policy、IAM role、CloudFront/OAC/TLS/キャッシュ/URL rewrite/403・404 fallback、Route53、outputs は不変。
- プロバイダーの code asset hash、IAM 権限、bootstrap version 条件も不変。
- 既存 `cdk.json` の feature flags を保持。新しい未設定 flag を自動で有効化していない。
- **既存の `RemovalPolicy.DESTROY` と `autoDeleteObjects: true` は維持**。スタック削除・リソース置換によるデータ削除リスクは元からある。今回、保持ポリシーや AWS セキュリティ設定を変更していない。

## 検証

- 基準状態: `npm ci --ignore-scripts` / build / 旧テスト / offline synth が完了。旧テストは検証内容のない 1 件だった。
- 更新後: npm 12.2.1 による clean `npm ci --ignore-scripts` が成功。
- TypeScript 7 の build、Node 標準テスト **24 件**が成功。
- テスト対象: 全 logical ID、S3 の公開防止と暗号化、既存削除ポリシー、IAM/bucket policy の厳密一致、CloudFront の HTTPS・TLS・cache・fallback、OAC、DNS、outputs、URL rewrite 8 パターン（query/header/cookie 等の保存を含む）、必須パラメーターエラー。
- `npm run synth:offline` が成功。AWS 認証情報を引き継がない環境・空の credential/config/env ファイル、metadata discovery 無効、`--no-lookups` / telemetry / notices 無効でローカル合成のみを行う。
- `npm run check`（build/test/synth/audit）と `npm ls --all` が成功。通常の `cdk.json` app コマンドも同じ架空値・credential-free 環境で実行し、offline helper と同一テンプレートになることを確認。
- `npm audit --audit-level=low`、全依存 / 本番依存 JSON 監査とも既知 advisory 0。
- CI を追加: PR と `main` への push で非デプロイ検証のみ。`contents: read`、checkout credential 非保存、AWS / OIDC 権限なし。Actions は確認した stable release の完全 SHA に固定（checkout v7.0.1 / setup-node v7.1.0）。

## 限界・未実施

この結果は監査時点の npm advisory データと検証した依存グラフに限定され、未知の脆弱性、bundled code のすべて、OS/クラウド基盤、実運用設定を完全に保証するものではない。CDK の advisory にはこのスタックが利用しない constructs のものもあり、更新前のすべてが本アプリで攻撃可能だったと断定しない。

AWS 認証情報の作成・利用、lookup、bootstrap、deploy/apply、destroy、実スタックの変更・drift 調査、main へのマージ、auto-merge は実施していない。実デプロイ、Route53 / ACM の存在・権限・証明書カバレッジ、配信中サイトへの影響は未検証。デプロイ前に、承認済みの AWS 環境で実スタックとの diff を別途レビューすること。offline synth の `cdk.out` は架空の値なのでデプロイに使わない。

## 参照

- [AWS CDK の Node.js 対応方針](https://docs.aws.amazon.com/cdk/v2/guide/node-versions.html)
- [Node.js release / LTS 情報](https://nodejs.org/en/about/previous-releases)
- [aws-cdk-lib stable](https://www.npmjs.com/package/aws-cdk-lib)
- [CDK CLI の正規パッケージ](https://www.npmjs.com/package/cdk)
- [TypeScript](https://www.npmjs.com/package/typescript)、[ts-jest](https://www.npmjs.com/package/ts-jest)
- [checkout v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1)、[setup-node v7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0)
