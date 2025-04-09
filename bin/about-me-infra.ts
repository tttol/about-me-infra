#!/usr/bin/env node
import * as dotenv from 'dotenv';
dotenv.config();

import * as cdk from 'aws-cdk-lib';
import { AboutMeInfraStack } from '../lib/about-me-infra-stack';

const app = new cdk.App();
new AboutMeInfraStack(app, 'AboutMeInfraStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  domainName: process.env.DOMAIN_NAME,
  hostedZoneId: process.env.HOSTED_ZONE_ID,
});