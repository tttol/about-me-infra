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

# CDK デプロイ
npm run cdk deploy

# CDK diff（変更確認）
npm run cdk diff

# CDK synth（CloudFormation テンプレート生成）
npm run cdk synth
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
