# American Express Expenses App - AWS Deployment Information

## Overview
This document contains all necessary information to deploy the American Express Expenses app as a subdomain of sukutapps.com.

## AWS Account Information
- **AWS Account ID**: 322325783793
- **IAM User**: portal-admin
- **Region**: us-east-1
- **Parent Domain**: sukutapps.com
- **SSL Certificate ARN**: arn:aws:acm:us-east-1:322325783793:certificate/73f5b7c0-e5ea-4cdc-b39f-289130cc25d9
  - This wildcard certificate covers *.sukutapps.com (includes amex.sukutapps.com)
- **Route 53 Hosted Zone ID**: Z0860330TU6D8FUIUUAJ

## Target Deployment URL
Your app will be deployed at: **https://amex.sukutapps.com**

## Step-by-Step Deployment Instructions

### 1. Prerequisites
Ensure AWS CLI is configured with portal-admin credentials:
```bash
aws sts get-caller-identity
# Should show: arn:aws:iam::322325783793:user/portal-admin
```

### 2. Create S3 Bucket for Amex App
```bash
# Create bucket with unique name
aws s3 mb s3://sukutapps-amex-expenses

# Create bucket policy file
cat > amex-bucket-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::sukutapps-amex-expenses/*"
    }
  ]
}
EOF

# Disable block public access
aws s3api put-public-access-block \
  --bucket sukutapps-amex-expenses \
  --public-access-block-configuration "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"

# Apply bucket policy
aws s3api put-bucket-policy \
  --bucket sukutapps-amex-expenses \
  --policy file://amex-bucket-policy.json

# Enable static website hosting
aws s3 website s3://sukutapps-amex-expenses \
  --index-document index.html \
  --error-document index.html
```

### 3. Build and Deploy Your App
```bash
# Build your Amex app
npm run build  # or your build command

# Deploy to S3
aws s3 sync dist/ s3://sukutapps-amex-expenses --delete
```

### 4. Create CloudFront Distribution

Create `amex-cloudfront-config.json`:
```json
{
  "CallerReference": "sukutapps-amex-$(date +%s)",
  "Comment": "American Express Expenses App",
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "S3-sukutapps-amex-expenses",
        "DomainName": "sukutapps-amex-expenses.s3-website-us-east-1.amazonaws.com",
        "CustomOriginConfig": {
          "HTTPPort": 80,
          "HTTPSPort": 443,
          "OriginProtocolPolicy": "http-only"
        }
      }
    ]
  },
  "Aliases": {
    "Quantity": 1,
    "Items": ["amex.sukutapps.com"]
  },
  "ViewerCertificate": {
    "ACMCertificateArn": "arn:aws:acm:us-east-1:322325783793:certificate/73f5b7c0-e5ea-4cdc-b39f-289130cc25d9",
    "SSLSupportMethod": "sni-only",
    "MinimumProtocolVersion": "TLSv1.2_2021"
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-sukutapps-amex-expenses",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["GET", "HEAD"]
    },
    "Compress": true,
    "ForwardedValues": {
      "QueryString": false,
      "Cookies": {
        "Forward": "none"
      }
    },
    "TrustedSigners": {
      "Enabled": false,
      "Quantity": 0
    },
    "MinTTL": 0,
    "DefaultTTL": 86400,
    "MaxTTL": 31536000
  },
  "CustomErrorResponses": {
    "Quantity": 1,
    "Items": [
      {
        "ErrorCode": 404,
        "ResponsePagePath": "/index.html",
        "ResponseCode": "200",
        "ErrorCachingMinTTL": 300
      }
    ]
  },
  "Enabled": true
}
```

Deploy CloudFront:
```bash
aws cloudfront create-distribution --distribution-config file://amex-cloudfront-config.json
```

**IMPORTANT**: Save the Distribution ID and Domain Name from the output!

### 5. Configure Route 53

Wait for CloudFront to deploy (check status):
```bash
aws cloudfront get-distribution --id YOUR_DISTRIBUTION_ID --query "Distribution.Status"
```

Once status is "Deployed", create Route 53 record:

Create `amex-route53-record.json`:
```json
{
  "Changes": [
    {
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "amex.sukutapps.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z2FDTNDATAQYW2",
          "DNSName": "YOUR_CLOUDFRONT_DOMAIN.cloudfront.net",
          "EvaluateTargetHealth": false
        }
      }
    }
  ]
}
```

Apply the record:
```bash
aws route53 change-resource-record-sets \
  --hosted-zone-id Z0860330TU6D8FUIUUAJ \
  --change-batch file://amex-route53-record.json
```

### 6. Create Deployment Script

Create `deploy-amex.sh` in your Amex app:
```bash
#!/bin/bash
set -e

DISTRIBUTION_ID="YOUR_AMEX_DISTRIBUTION_ID"
S3_BUCKET="sukutapps-amex-expenses"

echo "🏗️ Building American Express Expenses App..."
npm run build

echo "📦 Deploying to S3..."
aws s3 sync dist/ s3://$S3_BUCKET \
  --delete \
  --cache-control "public, max-age=31536000" \
  --exclude "index.html" \
  --exclude "*.map"

aws s3 cp dist/index.html s3://$S3_BUCKET/index.html \
  --cache-control "no-cache, no-store, must-revalidate"

echo "🔄 Invalidating CloudFront cache..."
aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*"

echo "✅ Deployment complete!"
echo "🌐 View at: https://amex.sukutapps.com"
```

Make it executable:
```bash
chmod +x deploy-amex.sh
```

## Portal Integration

The portal is already configured to link to your app at `https://amex.sukutapps.com`. The tile shows:
- **Name**: American Express Expenses
- **Icon**: 💳
- **Color**: Purple (bg-purple-500)
- **Access**: Admin and Manager roles

## Environment Variables

If your Amex app needs to know its public URL, add to your `.env.production`:
```
VITE_PUBLIC_URL=https://amex.sukutapps.com
VITE_API_URL=https://api.sukutapps.com  # If you have a backend API
```

## Testing

After deployment:
1. Test direct CloudFront URL: `https://YOUR_CLOUDFRONT_DOMAIN.cloudfront.net`
2. Test subdomain (after DNS propagation): `https://amex.sukutapps.com`
3. Test from portal: `https://sukutapps.com` → Click "American Express Expenses" tile

## Troubleshooting

**DNS not working?**
- DNS propagation takes 5-60 minutes
- Check with: `nslookup amex.sukutapps.com`

**Getting 403 Forbidden?**
- Check S3 bucket policy is applied
- Verify CloudFront origin settings

**React Router not working?**
- Ensure CloudFront custom error page redirects 404 to index.html

## Important Notes

1. **SSL Certificate**: Already valid for amex.sukutapps.com (wildcard cert)
2. **CloudFront Hosted Zone ID**: Always use `Z2FDTNDATAQYW2` for CloudFront aliases
3. **Cache Invalidation**: Costs $0.005 per path after first 1000/month
4. **S3 Bucket Name**: Must be globally unique

## Support Resources

- [AWS S3 Static Website Hosting](https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteHosting.html)
- [CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
- [Route 53 Alias Records](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resource-record-sets-choosing-alias-non-alias.html)

## Contact

For AWS account access or permission issues, contact your AWS administrator with:
- IAM User: portal-admin
- Account ID: 322325783793