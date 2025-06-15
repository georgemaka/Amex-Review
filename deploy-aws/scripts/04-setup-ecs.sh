#!/bin/bash
# Script 4: Set up ECS cluster, ECR repositories, and deploy services
# Run after 03-setup-storage.sh

set -e

echo "=== AMEX Review Portal - ECS Setup ==="

# Load infrastructure config
source deploy-aws/config/infrastructure.env

# Configuration
export AWS_REGION="us-east-1"
export AWS_ACCOUNT_ID="322325783793"
export PROJECT_NAME="amex-review"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Create IAM roles if they don't exist
echo "Setting up IAM roles..."

# ECS Task Execution Role
EXECUTION_ROLE_NAME="ecsTaskExecutionRole"
if ! aws iam get-role --role-name $EXECUTION_ROLE_NAME &>/dev/null; then
    echo "Creating ECS Task Execution Role..."
    aws iam create-role --role-name $EXECUTION_ROLE_NAME \
        --assume-role-policy-document '{
            "Version": "2012-10-17",
            "Statement": [{
                "Effect": "Allow",
                "Principal": {"Service": "ecs-tasks.amazonaws.com"},
                "Action": "sts:AssumeRole"
            }]
        }'
    
    aws iam attach-role-policy --role-name $EXECUTION_ROLE_NAME \
        --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
    
    # Add secrets manager permissions
    aws iam put-role-policy --role-name $EXECUTION_ROLE_NAME \
        --policy-name SecretsManagerAccess \
        --policy-document '{
            "Version": "2012-10-17",
            "Statement": [{
                "Effect": "Allow",
                "Action": [
                    "secretsmanager:GetSecretValue"
                ],
                "Resource": "arn:aws:secretsmanager:'$AWS_REGION':'$AWS_ACCOUNT_ID':secret:'$PROJECT_NAME'/*"
            }]
        }'
fi

# ECS Task Role
TASK_ROLE_NAME="ecsTaskRole"
if ! aws iam get-role --role-name $TASK_ROLE_NAME &>/dev/null; then
    echo "Creating ECS Task Role..."
    aws iam create-role --role-name $TASK_ROLE_NAME \
        --assume-role-policy-document '{
            "Version": "2012-10-17",
            "Statement": [{
                "Effect": "Allow",
                "Principal": {"Service": "ecs-tasks.amazonaws.com"},
                "Action": "sts:AssumeRole"
            }]
        }'
    
    # Attach storage policy
    aws iam attach-role-policy --role-name $TASK_ROLE_NAME \
        --policy-arn $STORAGE_POLICY_ARN
    
    # Add CloudWatch logs permissions
    aws iam attach-role-policy --role-name $TASK_ROLE_NAME \
        --policy-arn arn:aws:iam::aws:policy/CloudWatchLogsFullAccess
fi

# Create ECR repositories
echo "Creating ECR repositories..."
for repo in backend frontend; do
    if ! aws ecr describe-repositories --repository-names ${PROJECT_NAME}/${repo} &>/dev/null; then
        aws ecr create-repository \
            --repository-name ${PROJECT_NAME}/${repo} \
            --image-scanning-configuration scanOnPush=true \
            --encryption-configuration encryptionType=AES256
        echo -e "${GREEN}✓ Created ECR repository: ${PROJECT_NAME}/${repo}${NC}"
    else
        echo "ECR repository already exists: ${PROJECT_NAME}/${repo}"
    fi
done

# Create ECS Cluster
echo "Creating ECS cluster..."
CLUSTER_NAME="${PROJECT_NAME}-cluster"

if ! aws ecs describe-clusters --clusters $CLUSTER_NAME --query "clusters[0].clusterName" &>/dev/null; then
    aws ecs create-cluster \
        --cluster-name $CLUSTER_NAME \
        --capacity-providers FARGATE FARGATE_SPOT \
        --default-capacity-provider-strategy \
            capacityProvider=FARGATE,weight=1,base=1 \
            capacityProvider=FARGATE_SPOT,weight=1,base=0 \
        --settings name=containerInsights,value=enabled
    echo -e "${GREEN}✓ ECS cluster created${NC}"
else
    echo "ECS cluster already exists"
fi

# Create Application Load Balancer
echo "Creating Application Load Balancer..."
ALB_NAME="${PROJECT_NAME}-alb"

ALB_ARN=$(aws elbv2 describe-load-balancers --names $ALB_NAME --query "LoadBalancers[0].LoadBalancerArn" --output text 2>/dev/null || echo "None")

if [ "$ALB_ARN" == "None" ]; then
    ALB_ARN=$(aws elbv2 create-load-balancer \
        --name $ALB_NAME \
        --subnets $PUBLIC_SUBNET_1A $PUBLIC_SUBNET_1B \
        --security-groups $ALB_SG \
        --scheme internet-facing \
        --type application \
        --ip-address-type ipv4 \
        --query 'LoadBalancers[0].LoadBalancerArn' \
        --output text)
    
    # Wait for ALB to be active
    echo "Waiting for ALB to be active..."
    aws elbv2 wait load-balancer-available --load-balancer-arns $ALB_ARN
    echo -e "${GREEN}✓ ALB created${NC}"
else
    echo "ALB already exists"
fi

# Get ALB DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers \
    --load-balancer-arns $ALB_ARN \
    --query 'LoadBalancers[0].DNSName' \
    --output text)

echo "ALB DNS: $ALB_DNS"

# Create Target Groups
echo "Creating target groups..."

# Backend target group
BACKEND_TG_ARN=$(aws elbv2 describe-target-groups --names ${PROJECT_NAME}-backend-tg --query "TargetGroups[0].TargetGroupArn" --output text 2>/dev/null || echo "None")
if [ "$BACKEND_TG_ARN" == "None" ]; then
    BACKEND_TG_ARN=$(aws elbv2 create-target-group \
        --name ${PROJECT_NAME}-backend-tg \
        --protocol HTTP \
        --port 8000 \
        --vpc-id $VPC_ID \
        --target-type ip \
        --health-check-enabled \
        --health-check-path /health \
        --health-check-interval-seconds 30 \
        --health-check-timeout-seconds 5 \
        --healthy-threshold-count 2 \
        --unhealthy-threshold-count 3 \
        --query 'TargetGroups[0].TargetGroupArn' \
        --output text)
    echo -e "${GREEN}✓ Backend target group created${NC}"
fi

# Frontend target group
FRONTEND_TG_ARN=$(aws elbv2 describe-target-groups --names ${PROJECT_NAME}-frontend-tg --query "TargetGroups[0].TargetGroupArn" --output text 2>/dev/null || echo "None")
if [ "$FRONTEND_TG_ARN" == "None" ]; then
    FRONTEND_TG_ARN=$(aws elbv2 create-target-group \
        --name ${PROJECT_NAME}-frontend-tg \
        --protocol HTTP \
        --port 80 \
        --vpc-id $VPC_ID \
        --target-type ip \
        --health-check-enabled \
        --health-check-path /health \
        --health-check-interval-seconds 30 \
        --health-check-timeout-seconds 5 \
        --healthy-threshold-count 2 \
        --unhealthy-threshold-count 3 \
        --query 'TargetGroups[0].TargetGroupArn' \
        --output text)
    echo -e "${GREEN}✓ Frontend target group created${NC}"
fi

# Create ALB Listeners
echo "Creating ALB listeners..."

# HTTP listener (redirects to HTTPS in production)
HTTP_LISTENER_ARN=$(aws elbv2 describe-listeners --load-balancer-arn $ALB_ARN --query "Listeners[?Port==\`80\`].ListenerArn" --output text 2>/dev/null || echo "None")
if [ "$HTTP_LISTENER_ARN" == "None" ]; then
    aws elbv2 create-listener \
        --load-balancer-arn $ALB_ARN \
        --protocol HTTP \
        --port 80 \
        --default-actions Type=forward,TargetGroupArn=$FRONTEND_TG_ARN
fi

# Add listener rules for backend
RULE_EXISTS=$(aws elbv2 describe-rules --listener-arn $HTTP_LISTENER_ARN --query "Rules[?Conditions[?Field=='path-pattern']].RuleArn" --output text 2>/dev/null || echo "None")
if [ "$RULE_EXISTS" == "None" ] || [ -z "$RULE_EXISTS" ]; then
    aws elbv2 create-rule \
        --listener-arn $HTTP_LISTENER_ARN \
        --priority 100 \
        --conditions Field=path-pattern,Values="/api/*" \
        --actions Type=forward,TargetGroupArn=$BACKEND_TG_ARN
fi

# Save configuration
cat >> deploy-aws/config/infrastructure.env << EOF

# ECS Configuration - Generated $(date)
export CLUSTER_NAME=$CLUSTER_NAME
export ALB_ARN=$ALB_ARN
export ALB_DNS=$ALB_DNS
export BACKEND_TG_ARN=$BACKEND_TG_ARN
export FRONTEND_TG_ARN=$FRONTEND_TG_ARN
export EXECUTION_ROLE_ARN=arn:aws:iam::${AWS_ACCOUNT_ID}:role/${EXECUTION_ROLE_NAME}
export TASK_ROLE_ARN=arn:aws:iam::${AWS_ACCOUNT_ID}:role/${TASK_ROLE_NAME}
EOF

echo ""
echo -e "${GREEN}=== ECS setup complete! ===${NC}"
echo ""
echo "Resources created:"
echo "- ECS Cluster: $CLUSTER_NAME"
echo "- ECR Repositories: ${PROJECT_NAME}/backend, ${PROJECT_NAME}/frontend"
echo "- Application Load Balancer: $ALB_DNS"
echo ""
echo "Next steps:"
echo "1. Build and push Docker images: ./05-build-and-push.sh"
echo "2. Deploy services: ./06-deploy-services.sh"
echo "3. Configure Route 53: ./07-configure-dns.sh"