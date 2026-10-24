import * as assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { before, describe, it } from 'node:test';
import { runInNewContext } from 'node:vm';
import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { AboutMeInfraStack } from '../lib/about-me-infra-stack';

const account = '111111111111';
const region = 'us-east-1';
const certificateArn = `arn:aws:acm:${region}:${account}:certificate/00000000-0000-4000-8000-000000000000`;
const hostedZoneId = 'Z0123456789EXAMPLE';
const context = JSON.parse(readFileSync(join(process.cwd(), 'cdk.json'), 'utf8')).context;

const sites = [
  {
    domain: 'example.com',
    bucketName: `about-me-infra-${account}`,
    bucket: 'AboutMeInfraBucket1258B419',
    policy: 'AboutMeInfraBucketPolicy110A8925',
    autoDelete: 'AboutMeInfraBucketAutoDeleteObjectsCustomResource438BEEE1',
    distribution: 'AboutMeDistribution57D44718',
    origin: 'AboutMeInfraStackAboutMeDistributionOrigin1331A6189',
    accessControl: 'AboutMeDistributionOrigin1S3OriginAccessControl4222B424',
    record: 'AliasRecord851000D2',
  },
  {
    domain: 'blog.example.com',
    bucketName: `blog-about-me-infra-${account}`,
    bucket: 'BlogBucket3E358F18',
    policy: 'BlogBucketPolicy81EFCEDB',
    autoDelete: 'BlogBucketAutoDeleteObjectsCustomResource9F11A136',
    distribution: 'BlogDistribution9337E81F',
    origin: 'AboutMeInfraStackBlogDistributionOrigin19C33E2AA',
    accessControl: 'BlogDistributionOrigin1S3OriginAccessControlCDDD1EED',
    record: 'BlogAliasRecord6BC43687',
  },
];

const providerRole = 'CustomS3AutoDeleteObjectsCustomResourceProviderRole3B1BD092';
const providerHandler = 'CustomS3AutoDeleteObjectsCustomResourceProviderHandler9D90184F';
const rewriteFunction = 'UrlRewriteFunction9ABF1F87';

// Imported hosted-zone/certificate attributes use fictional values and need no AWS calls.
function withApp<T>(run: (app: cdk.App) => T): T {
  const outdir = mkdtempSync(join(tmpdir(), 'about-me-infra-test-'));
  const originalCertificate = process.env.ACM_CERTIFICATE_ARN;
  process.env.ACM_CERTIFICATE_ARN = certificateArn;
  try {
    return run(new cdk.App({ outdir, context, analyticsReporting: false }));
  } finally {
    if (originalCertificate === undefined) {
      delete process.env.ACM_CERTIFICATE_ARN;
    } else {
      process.env.ACM_CERTIFICATE_ARN = originalCertificate;
    }
    rmSync(outdir, { recursive: true, force: true });
  }
}

describe('AboutMeInfraStack offline regression checks', () => {
  let template: Template;

  before(() => {
    template = withApp((app) => Template.fromStack(new AboutMeInfraStack(app, 'AboutMeInfraStack', {
      env: { account, region },
      domainName: 'example.com',
      hostedZoneId,
    })));
  });

  it('preserves every baseline resource logical ID and resource type', () => {
    const expected: Record<string, string> = {
      [providerRole]: 'AWS::IAM::Role',
      [providerHandler]: 'AWS::Lambda::Function',
      [rewriteFunction]: 'AWS::CloudFront::Function',
    };
    for (const site of sites) {
      Object.assign(expected, {
        [site.bucket]: 'AWS::S3::Bucket',
        [site.policy]: 'AWS::S3::BucketPolicy',
        [site.autoDelete]: 'Custom::S3AutoDeleteObjects',
        [site.distribution]: 'AWS::CloudFront::Distribution',
        [site.accessControl]: 'AWS::CloudFront::OriginAccessControl',
        [site.record]: 'AWS::Route53::RecordSet',
      });
    }
    const resources = template.toJSON().Resources;
    const actual = Object.fromEntries(Object.keys(resources).map((id) => [id, resources[id].Type]));
    assert.deepEqual(actual, expected);
  });

  for (const site of sites) {
    it(`${site.domain}: preserves the private, encrypted bucket and existing deletion policy`, () => {
      const bucket = template.findResources('AWS::S3::Bucket')[site.bucket];
      assert.equal(bucket.Properties.BucketName, site.bucketName);
      assert.deepEqual(bucket.Properties.PublicAccessBlockConfiguration, {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      });
      assert.deepEqual(bucket.Properties.BucketEncryption, {
        ServerSideEncryptionConfiguration: [{
          ServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' },
        }],
      });
      assert.equal(bucket.Properties.AccessControl, undefined);
      // Preserve DESTROY/autoDeleteObjects: this upgrade is not a retention-policy change.
      assert.equal(bucket.DeletionPolicy, 'Delete');
      assert.equal(bucket.UpdateReplacePolicy, 'Delete');
      assert.deepEqual(bucket.Properties.Tags, [{ Key: 'aws-cdk:auto-delete-objects', Value: 'true' }]);
      const autoDelete = template.findResources('Custom::S3AutoDeleteObjects')[site.autoDelete];
      assert.deepEqual(autoDelete.Properties, {
        ServiceToken: { 'Fn::GetAtt': [providerHandler, 'Arn'] },
        BucketName: { Ref: site.bucket },
      });
      assert.deepEqual(autoDelete.DependsOn, [site.policy]);
      assert.equal(autoDelete.DeletionPolicy, 'Delete');
      assert.equal(autoDelete.UpdateReplacePolicy, 'Delete');
    });

    it(`${site.domain}: restricts bucket access to its distribution and existing cleanup provider`, () => {
      const policy = template.findResources('AWS::S3::BucketPolicy')[site.policy];
      assert.deepEqual(policy.Properties.Bucket, { Ref: site.bucket });
      assert.deepEqual(policy.Properties.PolicyDocument, {
        Version: '2012-10-17',
        Statement: [
          {
            Action: ['s3:DeleteObject*', 's3:GetBucket*', 's3:List*', 's3:PutBucketPolicy'],
            Effect: 'Allow',
            Principal: { AWS: { 'Fn::GetAtt': [providerRole, 'Arn'] } },
            Resource: [
              { 'Fn::GetAtt': [site.bucket, 'Arn'] },
              { 'Fn::Join': ['', [{ 'Fn::GetAtt': [site.bucket, 'Arn'] }, '/*']] },
            ],
          },
          {
            Action: 's3:GetObject',
            Condition: {
              StringEquals: {
                'AWS:SourceArn': {
                  'Fn::Join': ['', [
                    'arn:', { Ref: 'AWS::Partition' }, ':cloudfront::',
                    { Ref: 'AWS::AccountId' }, ':distribution/', { Ref: site.distribution },
                  ]],
                },
              },
            },
            Effect: 'Allow',
            Principal: { Service: 'cloudfront.amazonaws.com' },
            Resource: { 'Fn::Join': ['', [{ 'Fn::GetAtt': [site.bucket, 'Arn'] }, '/*']] },
          },
        ],
      });
    });

    it(`${site.domain}: preserves HTTPS, cache, certificate, rewrite association, and fallback behavior`, () => {
      const distribution = template.findResources('AWS::CloudFront::Distribution')[site.distribution];
      const config = distribution.Properties.DistributionConfig;
      assert.deepEqual(config.Aliases, [site.domain]);
      assert.equal(config.Enabled, true);
      assert.equal(config.DefaultRootObject, 'index.html');
      assert.equal(config.HttpVersion, 'http2');
      assert.equal(config.IPV6Enabled, true);
      assert.deepEqual(config.ViewerCertificate, {
        AcmCertificateArn: certificateArn,
        MinimumProtocolVersion: 'TLSv1.2_2021',
        SslSupportMethod: 'sni-only',
      });
      assert.deepEqual(config.DefaultCacheBehavior, {
        CachePolicyId: '658327ea-f89d-4fab-a63d-7e88639e58f6',
        Compress: true,
        FunctionAssociations: [{
          EventType: 'viewer-request',
          FunctionARN: { 'Fn::GetAtt': [rewriteFunction, 'FunctionARN'] },
        }],
        TargetOriginId: site.origin,
        ViewerProtocolPolicy: 'redirect-to-https',
      });
      assert.deepEqual(config.CustomErrorResponses, [
        { ErrorCode: 404, ResponseCode: 200, ResponsePagePath: '/index.html' },
        { ErrorCode: 403, ResponseCode: 200, ResponsePagePath: '/index.html' },
      ]);
      assert.deepEqual(config.Origins, [{
        DomainName: { 'Fn::GetAtt': [site.bucket, 'RegionalDomainName'] },
        Id: site.origin,
        OriginAccessControlId: { 'Fn::GetAtt': [site.accessControl, 'Id'] },
        S3OriginConfig: { OriginAccessIdentity: '' },
      }]);
      const accessControl = template.findResources('AWS::CloudFront::OriginAccessControl')[site.accessControl];
      assert.equal(accessControl.Properties.OriginAccessControlConfig.OriginAccessControlOriginType, 's3');
      assert.equal(accessControl.Properties.OriginAccessControlConfig.SigningBehavior, 'always');
      assert.equal(accessControl.Properties.OriginAccessControlConfig.SigningProtocol, 'sigv4');
    });

    it(`${site.domain}: keeps its DNS alias pointing at the matching distribution`, () => {
      const record = template.findResources('AWS::Route53::RecordSet')[site.record];
      assert.deepEqual(record.Properties, {
        AliasTarget: {
          DNSName: { 'Fn::GetAtt': [site.distribution, 'DomainName'] },
          HostedZoneId: {
            'Fn::FindInMap': ['AWSCloudFrontPartitionHostedZoneIdMap', { Ref: 'AWS::Partition' }, 'zoneId'],
          },
        },
        HostedZoneId: hostedZoneId,
        Name: `${site.domain}.`,
        Type: 'A',
      });
    });
  }

  it('preserves the cleanup provider role without adding permissions', () => {
    const role = template.findResources('AWS::IAM::Role')[providerRole];
    assert.deepEqual(role.Properties, {
      AssumeRolePolicyDocument: {
        Version: '2012-10-17',
        Statement: [{
          Action: 'sts:AssumeRole',
          Effect: 'Allow',
          Principal: { Service: 'lambda.amazonaws.com' },
        }],
      },
      ManagedPolicyArns: [{
        'Fn::Sub': 'arn:${AWS::Partition}:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
      }],
    });
    const provider = template.findResources('AWS::Lambda::Function')[providerHandler];
    assert.equal(provider.Properties.Timeout, 900);
    assert.equal(provider.Properties.MemorySize, 128);
    assert.equal(provider.Properties.Handler, 'index.handler');
    assert.deepEqual(provider.Properties.Role, { 'Fn::GetAtt': [providerRole, 'Arn'] });
    assert.equal(provider.Properties.Code.S3Bucket, `cdk-hnb659fds-assets-${account}-${region}`);
    // Reviewed upgrade: only this generated runtime changes (Node.js 20 -> 24).
    assert.equal(provider.Properties.Runtime, 'nodejs24.x');
  });

  it('preserves the shared CloudFront function identity and runtime', () => {
    const fn = template.findResources('AWS::CloudFront::Function')[rewriteFunction];
    assert.equal(fn.Properties.Name, 'url-rewrite-AboutMeInfraStack');
    assert.equal(fn.Properties.AutoPublish, true);
    assert.equal(fn.Properties.FunctionConfig.Runtime, 'cloudfront-js-1.0');
  });

  for (const [uri, expected] of [
    ['/', '/index.html'],
    ['/about', '/about/index.html'],
    ['/about/', '/about/index.html'],
    ['/blog/nested/post', '/blog/nested/post/index.html'],
    ['/index.html', '/index.html'],
    ['/_next/static/chunks/app.js', '/_next/static/chunks/app.js'],
    ['/images/profile.webp', '/images/profile.webp'],
    ['/v1.2/page', '/v1.2/page'],
  ]) {
    it(`rewrites ${uri} to ${expected} without changing other request fields`, () => {
      const functionCode = template.findResources('AWS::CloudFront::Function')[rewriteFunction].Properties.FunctionCode;
      const request = {
        uri,
        method: 'GET',
        headers: { host: { value: 'example.com' } },
        querystring: { page: { value: '2' } },
        cookies: { preference: { value: 'dark' } },
      };
      const beforeRequest = structuredClone(request);
      const result = runInNewContext(`${functionCode}\nhandler(event);`, { event: { request } }, { timeout: 1000 });
      assert.equal(result, request);
      assert.deepEqual(result, { ...beforeRequest, uri: expected });
    });
  }

  it('preserves the published root and blog URLs', () => {
    assert.deepEqual(template.toJSON().Outputs, {
      BlogURL: { Description: 'Blog Domain URL', Value: 'https://blog.example.com' },
      CloudFrontURL: { Description: 'Custom Domain URL', Value: 'https://example.com' },
    });
  });
});

describe('required stack parameters', () => {
  for (const missing of [undefined, '']) {
    it(`rejects domainName=${String(missing)}`, () => {
      withApp((app) => {
        assert.throws(() => new AboutMeInfraStack(app, 'MissingDomain', {
          env: { account, region },
          domainName: missing,
          hostedZoneId,
        }), /domainName is required/);
      });
    });

    it(`rejects hostedZoneId=${String(missing)}`, () => {
      withApp((app) => {
        assert.throws(() => new AboutMeInfraStack(app, 'MissingHostedZone', {
          env: { account, region },
          domainName: 'example.com',
          hostedZoneId: missing,
        }), /hostedZoneId is required/);
      });
    });
  }
});
