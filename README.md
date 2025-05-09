# about-me-infra
This is an infrastructure code of [about-me-app](https://github.com/tttol/about-me-app).

# Deloy
Create .env file
```
CDK_DEFAULT_ACCOUNT=AWS account ID
CDK_DEFAULT_REGION=AWS region
DOMAIN_NAME=domain name
HOSTED_ZONE_ID=Route 53 host zone ID
ACM_CERTIFICATE_ARN=arn:aws:acm:us-east-1:[AWS account ID]:certificate/xxx
```

Run `cdk deploy`