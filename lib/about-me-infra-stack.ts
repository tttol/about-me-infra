import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

export class AboutMeInfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const s3Bucket = new s3.Bucket(this, 'AboutMeInfraBucket', {
      bucketName: 'about-me-infra',
      publicReadAccess: true,

      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html',
    });

    // To deploy assets to s3 bucket
    const s3Deployment = new s3deploy.BucketDeployment(this, 'AboutMeInfraDeployment', {
      sources: [s3deploy.Source.asset('./asset')],
      destinationBucket: s3Bucket,
    });
  }
}
