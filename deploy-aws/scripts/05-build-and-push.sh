#!/bin/bash
# Script 5: Build and push Docker images to ECR
# Run after 04-setup-ecs.sh

set -e

echo "=== AMEX Review Portal - Build and Push Docker Images ==="

# Load infrastructure config
source deploy-aws/config/infrastructure.env

# Configuration
export AWS_REGION="us-east-1"
export AWS_ACCOUNT_ID="322325783793"
export PROJECT_NAME="amex-review"
export ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Get ECR login token
echo "Logging in to ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY

# Store SMTP credentials if not already stored
echo "Setting up email credentials..."
read -p "Enter SMTP username (or press Enter to skip): " SMTP_USER
if [ ! -z "$SMTP_USER" ]; then
    read -s -p "Enter SMTP password: " SMTP_PASSWORD
    echo ""
    
    aws secretsmanager create-secret \
        --name ${PROJECT_NAME}/smtp-user \
        --description "SMTP username" \
        --secret-string "$SMTP_USER" &>/dev/null || \
    aws secretsmanager update-secret \
        --secret-id ${PROJECT_NAME}/smtp-user \
        --secret-string "$SMTP_USER"
    
    aws secretsmanager create-secret \
        --name ${PROJECT_NAME}/smtp-password \
        --description "SMTP password" \
        --secret-string "$SMTP_PASSWORD" &>/dev/null || \
    aws secretsmanager update-secret \
        --secret-id ${PROJECT_NAME}/smtp-password \
        --secret-string "$SMTP_PASSWORD"
    
    echo -e "${GREEN}✓ SMTP credentials stored${NC}"
fi

# Build Backend Image
echo ""
echo "Building backend image..."
cd backend

# Use production Dockerfile
if [ -f Dockerfile.production ]; then
    docker build -f Dockerfile.production -t ${PROJECT_NAME}/backend:latest .
else
    docker build -t ${PROJECT_NAME}/backend:latest .
fi

# Tag and push backend
docker tag ${PROJECT_NAME}/backend:latest ${ECR_REGISTRY}/${PROJECT_NAME}/backend:latest
docker tag ${PROJECT_NAME}/backend:latest ${ECR_REGISTRY}/${PROJECT_NAME}/backend:$(git rev-parse --short HEAD)

echo "Pushing backend image..."
docker push ${ECR_REGISTRY}/${PROJECT_NAME}/backend:latest
docker push ${ECR_REGISTRY}/${PROJECT_NAME}/backend:$(git rev-parse --short HEAD)

echo -e "${GREEN}✓ Backend image pushed${NC}"

cd ..

# Build Frontend Image
echo ""
echo "Building frontend image..."
cd frontend

# Build with production API URL
if [ -f Dockerfile.production ]; then
    docker build -f Dockerfile.production \
        --build-arg REACT_APP_API_URL=https://amex.sukutapps.com \
        -t ${PROJECT_NAME}/frontend:latest .
else
    docker build \
        --build-arg REACT_APP_API_URL=https://amex.sukutapps.com \
        -t ${PROJECT_NAME}/frontend:latest .
fi

# Tag and push frontend
docker tag ${PROJECT_NAME}/frontend:latest ${ECR_REGISTRY}/${PROJECT_NAME}/frontend:latest
docker tag ${PROJECT_NAME}/frontend:latest ${ECR_REGISTRY}/${PROJECT_NAME}/frontend:$(git rev-parse --short HEAD)

echo "Pushing frontend image..."
docker push ${ECR_REGISTRY}/${PROJECT_NAME}/frontend:latest
docker push ${ECR_REGISTRY}/${PROJECT_NAME}/frontend:$(git rev-parse --short HEAD)

echo -e "${GREEN}✓ Frontend image pushed${NC}"

cd ..

# Register Task Definitions
echo ""
echo "Registering task definitions..."

# Update task definitions with latest image tags
for task in backend frontend celery flower; do
    if [ -f deploy-aws/task-definitions/${task}.json ]; then
        echo "Registering ${task} task definition..."
        aws ecs register-task-definition \
            --cli-input-json file://deploy-aws/task-definitions/${task}.json \
            --query 'taskDefinition.revision' \
            --output text
    fi
done

echo ""
echo -e "${GREEN}=== Build and push complete! ===${NC}"
echo ""
echo "Images pushed to ECR:"
echo "- ${ECR_REGISTRY}/${PROJECT_NAME}/backend:latest"
echo "- ${ECR_REGISTRY}/${PROJECT_NAME}/frontend:latest"
echo ""
echo "Next step: Run ./06-deploy-services.sh"