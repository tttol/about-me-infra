import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// Never inherit AWS credentials or load the developer's .env during validation.
const home = mkdtempSync(join(tmpdir(), 'about-me-infra-synth-'));
const emptyConfig = join(home, 'empty-config');
writeFileSync(emptyConfig, '');
try {
  const result = spawnSync(process.execPath, [
    'node_modules/aws-cdk/bin/cdk', 'synth',
    '--app', 'node dist/bin/about-me-infra.js',
    '--no-lookups', '--no-notices', '--no-telemetry', '--no-version-reporting',
    '--output', resolve('cdk.out'),
  ], {
    stdio: 'inherit',
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      HOME: home,
      USERPROFILE: home,
      TMPDIR: home,
      DOTENV_CONFIG_PATH: emptyConfig,
      CDK_DEFAULT_ACCOUNT: '111111111111',
      CDK_DEFAULT_REGION: 'us-east-1',
      DOMAIN_NAME: 'example.com',
      HOSTED_ZONE_ID: 'Z0123456789EXAMPLE',
      ACM_CERTIFICATE_ARN: 'arn:aws:acm:us-east-1:111111111111:certificate/00000000-0000-4000-8000-000000000000',
      AWS_EC2_METADATA_DISABLED: 'true',
      AWS_SHARED_CREDENTIALS_FILE: emptyConfig,
      AWS_CONFIG_FILE: emptyConfig,
      CDK_DISABLE_VERSION_CHECK: '1',
    },
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(home, { recursive: true, force: true });
}
