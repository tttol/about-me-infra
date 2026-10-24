# about-me-infra

AWS CDK infrastructure for [about-me-app](https://github.com/tttol/about-me-app): private S3 buckets, CloudFront distributions and URL rewriting, and Route53 aliases for the main site and blog.

## Local validation (no AWS access required)

Use Node.js **24.22.1 LTS** (`.nvmrc`) and npm **12.2.1**:

```bash
nvm use
npm install --global npm@12.2.1 --ignore-scripts
npm ci --ignore-scripts
npm run check
```

`check` compiles TypeScript, runs Node's built-in regression tests, synthesizes a CloudFormation template with fictional values, and audits **all** dependencies, including development tools. The offline synth script isolates the environment, does not load your `.env` or AWS credential files, disables metadata credential discovery, lookups, notices, and telemetry, and writes only local `cdk.out/` files. It does not deploy anything.

Individual commands:

```bash
npm run build          # TypeScript -> dist/
npm test               # Build + infrastructure and URL-rewrite regression tests
npm run synth:offline  # Build + credential-free synth using example.com
npm audit --audit-level=low
```

GitHub Actions runs these checks on pull requests and pushes to `main` with read-only repository permissions. It has no AWS credentials, OIDC permission, or deployment step.

## Deployment (manual, separate from validation)

Copy `.env.example` to `.env` and fill in the real values:

```dotenv
CDK_DEFAULT_ACCOUNT=AWS account ID
CDK_DEFAULT_REGION=AWS region
DOMAIN_NAME=domain name
HOSTED_ZONE_ID=Route53 hosted zone ID
ACM_CERTIFICATE_ARN=arn:aws:acm:us-east-1:AWS_ACCOUNT_ID:certificate/xxx
```

The certificate must cover both the root domain and `blog` subdomain. Use your existing authorized AWS credentials. The CDK app builds the current TypeScript before running; no global CDK installation is required:

```bash
npm run cdk -- diff
# Review the deployed-stack diff and obtain deployment approval first.
npm run cdk -- deploy
```

Do not deploy `cdk.out/` produced by `synth:offline`: it uses fictional identifiers. Offline validation does not establish deployed-stack drift, certificate coverage, AWS permissions, or deployability in your account.

**Existing deletion behavior:** both buckets use `RemovalPolicy.DESTROY` and `autoDeleteObjects: true`. Deleting/replacing these resources can delete site/blog data. This dependency update deliberately preserves that behavior rather than silently changing lifecycle policy.

See [the dependency upgrade report](docs/security/dependency-upgrade-2026-10-24.md) for audit evidence, tested versions, and generated infrastructure changes.
