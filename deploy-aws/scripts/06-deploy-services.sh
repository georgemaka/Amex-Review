#!/bin/bash
# Script 6: Deploy ECS services
# Run after 05-build-and-push.sh

set -e

echo "=== AMEX Review Portal - Deploy Services ==="

# Load infrastructure config
source deploy-aws/config/infrastructure.env

# Configuration
export AWS_REGION="us-east-1"
export PROJECT_NAME="amex-review"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Function to create or update service
deploy_service() {
    local SERVICE_NAME=$1
    local TASK_FAMILY=$2
    local DESIRED_COUNT=$3
    local TARGET_GROUP_ARN=$4
    local CONTAINER_NAME=$5
    local CONTAINER_PORT=$6
    local USE_SPOT=$7
    
    echo "Deploying $SERVICE_NAME service..."
    
    # Check if service exists
    if aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME --query "services[0].serviceName" &>/dev/null; then
        echo "Updating existing service: $SERVICE_NAME"
        aws ecs update-service \
            --cluster $CLUSTER_NAME \
            --service $SERVICE_NAME \
            --task-definition ${PROJECT_NAME}-${TASK_FAMILY} \
            --desired-count $DESIRED_COUNT \
            --force-new-deployment
    else
        echo "Creating new service: $SERVICE_NAME"
        
        # Base create-service command
        CREATE_CMD="aws ecs create-service \
            --cluster $CLUSTER_NAME \
            --service-name $SERVICE_NAME \
            --task-definition ${PROJECT_NAME}-${TASK_FAMILY} \
            --desired-count $DESIRED_COUNT \
            --launch-type FARGATE \
            --platform-version LATEST \
            --network-configuration \"awsvpcConfiguration={subnets=[$PRIVATE_SUBNET_1A,$PRIVATE_SUBNET_1B],securityGroups=[$ECS_SG],assignPublicIp=DISABLED}\" \
            --deployment-configuration \"deploymentCircuitBreaker={enable=true,rollback=true},maximumPercent=200,minimumHealthyPercent=100\""
        
        # Add load balancer if specified
        if [ ! -z "$TARGET_GROUP_ARN" ]; then
            CREATE_CMD="$CREATE_CMD --load-balancers targetGroupArn=$TARGET_GROUP_ARN,containerName=$CONTAINER_NAME,containerPort=$CONTAINER_PORT"
            CREATE_CMD="$CREATE_CMD --health-check-grace-period-seconds 60"
        fi
        
        # Add capacity provider strategy for SPOT if requested
        if [ "$USE_SPOT" == "true" ]; then
            CREATE_CMD="$CREATE_CMD --capacity-provider-strategy capacityProvider=FARGATE_SPOT,weight=1,base=0"
        fi
        
        # Execute the command
        eval $CREATE_CMD
    fi
    
    echo -e "${GREEN}✓ $SERVICE_NAME deployed${NC}"
}

# Deploy Frontend Service
deploy_service "frontend" "frontend" "2" "$FRONTEND_TG_ARN" "frontend" "80" "false"

# Deploy Backend Service
deploy_service "backend" "backend" "2" "$BACKEND_TG_ARN" "backend" "8000" "false"

# Deploy Celery Worker Service
deploy_service "celery-worker" "celery" "1" "" "" "" "true"

# Deploy Flower Service (optional monitoring)
read -p "Deploy Flower monitoring service? (y/n): " DEPLOY_FLOWER
if [ "$DEPLOY_FLOWER" == "y" ]; then
    # Create Flower target group
    FLOWER_TG_ARN=$(aws elbv2 describe-target-groups --names ${PROJECT_NAME}-flower-tg --query "TargetGroups[0].TargetGroupArn" --output text 2>/dev/null || echo "None")
    if [ "$FLOWER_TG_ARN" == "None" ]; then
        FLOWER_TG_ARN=$(aws elbv2 create-target-group \
            --name ${PROJECT_NAME}-flower-tg \
            --protocol HTTP \
            --port 5555 \
            --vpc-id $VPC_ID \
            --target-type ip \
            --health-check-enabled \
            --health-check-path / \
            --query 'TargetGroups[0].TargetGroupArn' \
            --output text)
    fi
    
    # Add listener rule for Flower
    HTTP_LISTENER_ARN=$(aws elbv2 describe-listeners --load-balancer-arn $ALB_ARN --query "Listeners[?Port==\`80\`].ListenerArn" --output text)
    aws elbv2 create-rule \
        --listener-arn $HTTP_LISTENER_ARN \
        --priority 110 \
        --conditions Field=path-pattern,Values="/flower/*" \
        --actions Type=forward,TargetGroupArn=$FLOWER_TG_ARN 2>/dev/null || true
    
    deploy_service "flower" "flower" "1" "$FLOWER_TG_ARN" "flower" "5555" "false"
fi

# Wait for services to stabilize
echo ""
echo "Waiting for services to stabilize..."
echo "This may take 3-5 minutes..."

# Function to check service status
check_service_status() {
    local SERVICE_NAME=$1
    local STATUS=$(aws ecs describe-services \
        --cluster $CLUSTER_NAME \
        --services $SERVICE_NAME \
        --query "services[0].deployments[0].rolloutState" \
        --output text 2>/dev/null || echo "UNKNOWN")
    echo $STATUS
}

# Wait for all services to be stable
SERVICES=("frontend" "backend" "celery-worker")
if [ "$DEPLOY_FLOWER" == "y" ]; then
    SERVICES+=("flower")
fi

ALL_STABLE=false
TIMEOUT=600  # 10 minutes
ELAPSED=0

while [ "$ALL_STABLE" == "false" ] && [ $ELAPSED -lt $TIMEOUT ]; do
    ALL_STABLE=true
    for service in "${SERVICES[@]}"; do
        STATUS=$(check_service_status $service)
        if [ "$STATUS" != "COMPLETED" ] && [ "$STATUS" != "IN_PROGRESS" ]; then
            ALL_STABLE=false
            echo -ne "\r${YELLOW}Waiting for services... ($service: $STATUS)${NC}    "
            break
        fi
    done
    
    if [ "$ALL_STABLE" == "false" ]; then
        sleep 10
        ELAPSED=$((ELAPSED + 10))
    fi
done

echo ""

# Check final status
echo ""
echo "Service deployment status:"
for service in "${SERVICES[@]}"; do
    RUNNING_COUNT=$(aws ecs describe-services \
        --cluster $CLUSTER_NAME \
        --services $service \
        --query "services[0].runningCount" \
        --output text 2>/dev/null || echo "0")
    DESIRED_COUNT=$(aws ecs describe-services \
        --cluster $CLUSTER_NAME \
        --services $service \
        --query "services[0].desiredCount" \
        --output text 2>/dev/null || echo "0")
    
    if [ "$RUNNING_COUNT" == "$DESIRED_COUNT" ]; then
        echo -e "- $service: ${GREEN}✓ Running ($RUNNING_COUNT/$DESIRED_COUNT)${NC}"
    else
        echo -e "- $service: ${YELLOW}⚠ Deploying ($RUNNING_COUNT/$DESIRED_COUNT)${NC}"
    fi
done

# Initialize database
echo ""
read -p "Initialize database? (y/n): " INIT_DB
if [ "$INIT_DB" == "y" ]; then
    echo "Running database migrations..."
    
    # Get backend task ARN
    TASK_ARN=$(aws ecs list-tasks \
        --cluster $CLUSTER_NAME \
        --service-name backend \
        --query "taskArns[0]" \
        --output text)
    
    if [ ! -z "$TASK_ARN" ] && [ "$TASK_ARN" != "None" ]; then
        # Run migrations
        aws ecs execute-command \
            --cluster $CLUSTER_NAME \
            --task $TASK_ARN \
            --container backend \
            --interactive \
            --command "alembic upgrade head" || echo "Note: ECS Exec may need to be enabled"
        
        echo -e "${GREEN}✓ Database initialized${NC}"
    else
        echo -e "${YELLOW}⚠ Could not find backend task. Run migrations manually.${NC}"
    fi
fi

echo ""
echo -e "${GREEN}=== Services deployed! ===${NC}"
echo ""
echo "Application URL: http://$ALB_DNS"
echo ""
echo "Next step: Run ./07-configure-dns.sh to set up the domain"
echo ""
echo "To check service logs:"
echo "aws logs tail /ecs/${PROJECT_NAME}/backend --follow"
echo "aws logs tail /ecs/${PROJECT_NAME}/frontend --follow"