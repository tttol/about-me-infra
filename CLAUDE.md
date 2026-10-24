# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

AWS CDK (TypeScript) プロジェクト。[about-me-app](https://github.com/tttol/about-me-app) のインフラストラクチャコード。

## Commands

```bash
# ビルド
npm run build

# テスト
npm test

# AWS 認証情報不要のオフライン検証（build / test / synth / audit）
npm run check

# CDK デプロイ
npm run cdk -- deploy

# CDK diff（変更確認）
npm run cdk -- diff

# CDK synth（CloudFormation テンプレート生成）
npm run cdk -- synth
```

## Architecture

S3 + CloudFront + Route53 + ACM による静的サイトホスティング構成:

- **S3**: 静的アセット保存（パブリックアクセスブロック、OAC経由でCloudFrontからのみアクセス可能）
- **CloudFront**: CDN配信、HTTPS強制、カスタムドメイン対応
- **Route53**: カスタムドメインのAレコード（CloudFrontへのエイリアス）
- **ACM**: SSL/TLS証明書（us-east-1リージョンで事前作成が必要）

## Environment Variables

`.env` ファイルに以下を設定:

- `CDK_DEFAULT_ACCOUNT`: AWSアカウントID
- `CDK_DEFAULT_REGION`: AWSリージョン
- `DOMAIN_NAME`: カスタムドメイン名
- `HOSTED_ZONE_ID`: Route 53ホストゾーンID
- `ACM_CERTIFICATE_ARN`: ACM証明書ARN（us-east-1）

## Toolchain / CI

Node.js 24.22.1 LTS / npm 12.2.1 を使用。TypeScript は `dist/` に出力し、テストは Node 標準の `node:test` で実行する。Jest / ts-jest / ts-node は使用しない。`npm run synth:offline` は架空の識別子でローカル合成のみを行い、AWS にデプロイしない。CI にもデプロイ処理・AWS 認証情報はない。通常の CDK コマンドは `npm run cdk -- <command>` を使用する。
