import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface AboutMeInfraStackProps extends cdk.StackProps {
  domainName: string | undefined;
  hostedZoneId: string | undefined;
}

export class AboutMeInfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AboutMeInfraStackProps) {
    super(scope, id, props);

    // Validate required parameters
    if (!props.domainName) {
      throw new Error('domainName is required');
    }
    if (!props.hostedZoneId) {
      throw new Error('hostedZoneId is required');
    }

    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId: props.hostedZoneId,
      zoneName: props.domainName,
    });

    // S3 bucket for static assets
    const s3Bucket = new s3.Bucket(this, 'AboutMeInfraBucket', {
      bucketName: `about-me-infra-${this.account}`,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // Create ACM certificate in us-east-1 for CloudFront
    // const certificate = new acm.Certificate(this, 'Certificate', {
    //   domainName: props.domainName,
    // });

    const certificateArn = process.env.ACM_CERTIFICATE_ARN || '';
    const certificate = acm.Certificate.fromCertificateArn(this, 'Certificate', certificateArn);

    // CloudFront distribution with custom domain
    const distribution = new cloudfront.Distribution(this, 'AboutMeDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(s3Bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
      },
      domainNames: [props.domainName],
      certificate: certificate,
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
    });

    // Create A record for the domain
    new route53.ARecord(this, 'AliasRecord', {
      zone: hostedZone,
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(distribution)
      ),
    });
    
    // Output the CloudFront URL
    new cdk.CfnOutput(this, 'CloudFrontURL', {
      value: `https://${props.domainName}`,
      description: 'Custom Domain URL',
    });
  }
}
