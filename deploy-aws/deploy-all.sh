#!/bin/bash
# Master deployment script for AMEX Review Portal
# This script runs all deployment steps in sequence

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}==================================${NC}"
echo -e "${BLUE}AMEX Review Portal - AWS Deployment${NC}"
echo -e "${BLUE}==================================${NC}"
echo ""

# Check if we're in the right directory
if [ ! -f "deploy-aws/deploy-all.sh" ]; then
    echo -e "${RED}Error: Please run this script from the project root directory${NC}"
    exit 1
fi

# Create config directory
mkdir -p deploy-aws/config

# Check AWS CLI
echo "Checking AWS CLI..."
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI not found. Please install it first.${NC}"
    echo "Visit: https://aws.amazon.com/cli/"
    exit 1
fi

# Check AWS credentials
echo "Checking AWS credentials..."
aws sts get-caller-identity &>/dev/null || {
    echo -e "${RED}Error: AWS credentials not configured.${NC}"
    echo "Run: aws configure"
    exit 1
}

# Check Docker
echo "Checking Docker..."
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker not found. Please install Docker.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites checked${NC}"
echo ""

# Deployment menu
echo "This script will deploy the AMEX Review Portal to AWS ECS."
echo ""
echo "Select deployment option:"
echo "1. Full deployment (all steps)"
echo "2. Infrastructure only (VPC, RDS, ECS cluster)"
echo "3. Application only (build and deploy services)"
echo "4. Update existing deployment"
echo ""
read -p "Enter option (1-4): " OPTION

case $OPTION in
    1)
        echo ""
        echo -e "${YELLOW}Starting full deployment...${NC}"
        echo "This will create all AWS resources and deploy the application."
        read -p "Continue? (y/n): " CONFIRM
        if [ "$CONFIRM" != "y" ]; then
            echo "Deployment cancelled."
            exit 0
        fi
        
        # Run all scripts in sequence
        ./deploy-aws/scripts/01-setup-infrastructure.sh
        ./deploy-aws/scripts/02-setup-databases.sh
        ./deploy-aws/scripts/03-setup-storage.sh
        ./deploy-aws/scripts/04-setup-ecs.sh
        ./deploy-aws/scripts/05-build-and-push.sh
        ./deploy-aws/scripts/06-deploy-services.sh
        ./deploy-aws/scripts/07-configure-dns.sh
        ;;
        
    2)
        echo ""
        echo -e "${YELLOW}Setting up infrastructure only...${NC}"
        ./deploy-aws/scripts/01-setup-infrastructure.sh
        ./deploy-aws/scripts/02-setup-databases.sh
        ./deploy-aws/scripts/03-setup-storage.sh
        ./deploy-aws/scripts/04-setup-ecs.sh
        echo ""
        echo -e "${GREEN}Infrastructure setup complete!${NC}"
        echo "Run option 3 to deploy the application."
        ;;
        
    3)
        echo ""
        echo -e "${YELLOW}Deploying application...${NC}"
        if [ ! -f "deploy-aws/config/infrastructure.env" ]; then
            echo -e "${RED}Error: Infrastructure not set up. Run option 2 first.${NC}"
            exit 1
        fi
        ./deploy-aws/scripts/05-build-and-push.sh
        ./deploy-aws/scripts/06-deploy-services.sh
        ./deploy-aws/scripts/07-configure-dns.sh
        ;;
        
    4)
        echo ""
        echo -e "${YELLOW}Updating existing deployment...${NC}"
        if [ ! -f "deploy-aws/config/infrastructure.env" ]; then
            echo -e "${RED}Error: No existing deployment found.${NC}"
            exit 1
        fi
        ./deploy-aws/scripts/05-build-and-push.sh
        
        # Load config
        source deploy-aws/config/infrastructure.env
        
        # Update services
        echo "Updating ECS services..."
        aws ecs update-service --cluster $CLUSTER_NAME --service backend --force-new-deployment
        aws ecs update-service --cluster $CLUSTER_NAME --service frontend --force-new-deployment
        aws ecs update-service --cluster $CLUSTER_NAME --service celery-worker --force-new-deployment
        
        echo -e "${GREEN}✓ Deployment updated${NC}"
        ;;
        
    *)
        echo -e "${RED}Invalid option${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}==================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}==================================${NC}"
echo ""
echo "Your application is available at:"
echo -e "${BLUE}https://amex.sukutapps.com${NC}"
echo ""
echo "Important information:"
echo "- Admin login: admin@sukut.com / password123"
echo "- API docs: https://amex.sukutapps.com/api/v1/docs"
echo "- Logs: aws logs tail /ecs/amex-review/backend --follow"
echo ""
echo "GitHub Actions secrets to add:"
echo "- AWS_ACCESS_KEY_ID"
echo "- AWS_SECRET_ACCESS_KEY"
echo ""
echo -e "${YELLOW}Remember to:${NC}"
echo "1. Change the admin password after first login"
echo "2. Configure SMTP credentials for email sending"
echo "3. Set up CloudWatch alarms for monitoring"
echo "4. Review security group rules"
echo ""