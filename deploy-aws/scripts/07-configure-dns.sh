#!/bin/bash
# Script 7: Configure Route 53 DNS and SSL certificate
# Run after 06-deploy-services.sh

set -e

echo "=== AMEX Review Portal - DNS Configuration ==="

# Load infrastructure config
source deploy-aws/config/infrastructure.env

# Configuration
export AWS_REGION="us-east-1"
export DOMAIN="amex.sukutapps.com"
export HOSTED_ZONE_ID="Z0860330TU6D8FUIUUAJ"
export PROJECT_NAME="amex-review"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Request SSL Certificate
echo "Requesting SSL certificate for $DOMAIN..."
CERT_ARN=$(aws acm list-certificates --query "CertificateSummaryList[?DomainName=='$DOMAIN'].CertificateArn" --output text 2>/dev/null || echo "None")

if [ "$CERT_ARN" == "None" ] || [ -z "$CERT_ARN" ]; then
    CERT_ARN=$(aws acm request-certificate \
        --domain-name $DOMAIN \
        --validation-method DNS \
        --query 'CertificateArn' \
        --output text)
    
    echo "Certificate requested: $CERT_ARN"
    echo ""
    echo -e "${YELLOW}IMPORTANT: You must validate the certificate!${NC}"
    echo "1. Go to AWS Certificate Manager in the console"
    echo "2. Find the certificate for $DOMAIN"
    echo "3. Click 'Create record in Route 53' to validate"
    echo "4. Wait for validation to complete (usually 5-30 minutes)"
    echo ""
    read -p "Press Enter after certificate is validated..."
    
    # Wait for certificate to be issued
    echo "Waiting for certificate validation..."
    aws acm wait certificate-validated --certificate-arn $CERT_ARN
    echo -e "${GREEN}✓ Certificate validated${NC}"
else
    echo "Certificate already exists: $CERT_ARN"
fi

# Add HTTPS listener to ALB
echo "Adding HTTPS listener to ALB..."
HTTPS_LISTENER_ARN=$(aws elbv2 describe-listeners --load-balancer-arn $ALB_ARN --query "Listeners[?Port==\`443\`].ListenerArn" --output text 2>/dev/null || echo "None")

if [ "$HTTPS_LISTENER_ARN" == "None" ]; then
    HTTPS_LISTENER_ARN=$(aws elbv2 create-listener \
        --load-balancer-arn $ALB_ARN \
        --protocol HTTPS \
        --port 443 \
        --certificates CertificateArn=$CERT_ARN \
        --default-actions Type=forward,TargetGroupArn=$FRONTEND_TG_ARN \
        --query 'Listeners[0].ListenerArn' \
        --output text)
    
    # Add backend rule
    aws elbv2 create-rule \
        --listener-arn $HTTPS_LISTENER_ARN \
        --priority 100 \
        --conditions Field=path-pattern,Values="/api/*" \
        --actions Type=forward,TargetGroupArn=$BACKEND_TG_ARN
    
    echo -e "${GREEN}✓ HTTPS listener added${NC}"
else
    echo "HTTPS listener already exists"
fi

# Update HTTP listener to redirect to HTTPS
echo "Updating HTTP listener to redirect to HTTPS..."
HTTP_LISTENER_ARN=$(aws elbv2 describe-listeners --load-balancer-arn $ALB_ARN --query "Listeners[?Port==\`80\`].ListenerArn" --output text)

aws elbv2 modify-listener \
    --listener-arn $HTTP_LISTENER_ARN \
    --default-actions Type=redirect,RedirectConfig='{Protocol=HTTPS,Port=443,StatusCode=HTTP_301}'

# Create Route 53 A record
echo "Creating Route 53 DNS record..."

# Get ALB hosted zone ID
ALB_HOSTED_ZONE=$(aws elbv2 describe-load-balancers \
    --load-balancer-arns $ALB_ARN \
    --query 'LoadBalancers[0].CanonicalHostedZoneId' \
    --output text)

# Create change batch
cat > /tmp/route53-change.json << EOF
{
    "Changes": [{
        "Action": "UPSERT",
        "ResourceRecordSet": {
            "Name": "$DOMAIN",
            "Type": "A",
            "AliasTarget": {
                "HostedZoneId": "$ALB_HOSTED_ZONE",
                "DNSName": "$ALB_DNS",
                "EvaluateTargetHealth": true
            }
        }
    }]
}
EOF

# Apply the change
CHANGE_ID=$(aws route53 change-resource-record-sets \
    --hosted-zone-id $HOSTED_ZONE_ID \
    --change-batch file:///tmp/route53-change.json \
    --query 'ChangeInfo.Id' \
    --output text)

echo "Waiting for DNS change to propagate..."
aws route53 wait resource-record-sets-changed --id $CHANGE_ID

rm -f /tmp/route53-change.json

echo -e "${GREEN}✓ DNS configured${NC}"

# Test the deployment
echo ""
echo "Testing deployment..."
echo -n "Checking HTTP redirect... "
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://$DOMAIN)
if [ "$HTTP_STATUS" == "301" ]; then
    echo -e "${GREEN}✓ Working${NC}"
else
    echo -e "${YELLOW}⚠ Status: $HTTP_STATUS${NC}"
fi

echo -n "Checking HTTPS... "
HTTPS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN/health || echo "000")
if [ "$HTTPS_STATUS" == "200" ]; then
    echo -e "${GREEN}✓ Working${NC}"
else
    echo -e "${YELLOW}⚠ Status: $HTTPS_STATUS (may need more time for DNS propagation)${NC}"
fi

echo ""
echo -e "${GREEN}=== DNS configuration complete! ===${NC}"
echo ""
echo "Your application is now available at:"
echo "https://$DOMAIN"
echo ""
echo "It may take up to 15 minutes for DNS to fully propagate."
echo ""
echo "To monitor your application:"
echo "- CloudWatch Logs: aws logs tail /ecs/${PROJECT_NAME}/backend --follow"
echo "- ECS Console: https://console.aws.amazon.com/ecs/home?region=$AWS_REGION#/clusters/$CLUSTER_NAME"
echo "- Application URL: https://$DOMAIN"
echo ""
echo "Next steps:"
echo "1. Update frontend environment to use HTTPS URL"
echo "2. Configure auto-scaling if needed"
echo "3. Set up CloudWatch alarms"
echo "4. Configure backups"