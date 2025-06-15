#!/bin/bash
# Script 1: Set up AWS infrastructure for AMEX Review Portal
# Run this first to create all AWS resources

set -e  # Exit on error

echo "=== AMEX Review Portal - AWS Infrastructure Setup ==="
echo "This script will create all necessary AWS resources"
echo ""

# Configuration
export AWS_REGION="us-east-1"
export AWS_ACCOUNT_ID="322325783793"
export PROJECT_NAME="amex-review"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if resource exists
check_resource() {
    echo -ne "${YELLOW}Checking if $1 exists...${NC} "
}

# Function to report success
report_success() {
    echo -e "${GREEN}✓ Done${NC}"
}

# Function to report error
report_error() {
    echo -e "${RED}✗ Failed${NC}"
    echo -e "${RED}Error: $1${NC}"
    exit 1
}

# Check AWS CLI is configured
echo "Checking AWS CLI configuration..."
aws sts get-caller-identity || report_error "AWS CLI not configured. Run 'aws configure' first."
report_success

# Create VPC
check_resource "VPC"
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=tag:Name,Values=${PROJECT_NAME}-vpc" --query "Vpcs[0].VpcId" --output text 2>/dev/null)

if [ "$VPC_ID" == "None" ] || [ -z "$VPC_ID" ]; then
    echo "Creating VPC..."
    VPC_ID=$(aws ec2 create-vpc --cidr-block 10.0.0.0/16 --query 'Vpc.VpcId' --output text)
    aws ec2 create-tags --resources $VPC_ID --tags Key=Name,Value=${PROJECT_NAME}-vpc
    aws ec2 modify-vpc-attribute --vpc-id $VPC_ID --enable-dns-hostnames
    report_success
else
    echo "VPC already exists: $VPC_ID"
fi

# Create Internet Gateway
check_resource "Internet Gateway"
IGW_ID=$(aws ec2 describe-internet-gateways --filters "Name=tag:Name,Values=${PROJECT_NAME}-igw" --query "InternetGateways[0].InternetGatewayId" --output text 2>/dev/null)

if [ "$IGW_ID" == "None" ] || [ -z "$IGW_ID" ]; then
    echo "Creating Internet Gateway..."
    IGW_ID=$(aws ec2 create-internet-gateway --query 'InternetGateway.InternetGatewayId' --output text)
    aws ec2 create-tags --resources $IGW_ID --tags Key=Name,Value=${PROJECT_NAME}-igw
    aws ec2 attach-internet-gateway --vpc-id $VPC_ID --internet-gateway-id $IGW_ID
    report_success
else
    echo "Internet Gateway already exists: $IGW_ID"
fi

# Create Subnets
echo "Creating subnets..."

# Public Subnet 1a
PUBLIC_SUBNET_1A=$(aws ec2 describe-subnets --filters "Name=tag:Name,Values=${PROJECT_NAME}-public-1a" --query "Subnets[0].SubnetId" --output text 2>/dev/null)
if [ "$PUBLIC_SUBNET_1A" == "None" ] || [ -z "$PUBLIC_SUBNET_1A" ]; then
    PUBLIC_SUBNET_1A=$(aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.1.0/24 --availability-zone ${AWS_REGION}a --query 'Subnet.SubnetId' --output text)
    aws ec2 create-tags --resources $PUBLIC_SUBNET_1A --tags Key=Name,Value=${PROJECT_NAME}-public-1a
fi

# Public Subnet 1b
PUBLIC_SUBNET_1B=$(aws ec2 describe-subnets --filters "Name=tag:Name,Values=${PROJECT_NAME}-public-1b" --query "Subnets[0].SubnetId" --output text 2>/dev/null)
if [ "$PUBLIC_SUBNET_1B" == "None" ] || [ -z "$PUBLIC_SUBNET_1B" ]; then
    PUBLIC_SUBNET_1B=$(aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.2.0/24 --availability-zone ${AWS_REGION}b --query 'Subnet.SubnetId' --output text)
    aws ec2 create-tags --resources $PUBLIC_SUBNET_1B --tags Key=Name,Value=${PROJECT_NAME}-public-1b
fi

# Private Subnet 1a
PRIVATE_SUBNET_1A=$(aws ec2 describe-subnets --filters "Name=tag:Name,Values=${PROJECT_NAME}-private-1a" --query "Subnets[0].SubnetId" --output text 2>/dev/null)
if [ "$PRIVATE_SUBNET_1A" == "None" ] || [ -z "$PRIVATE_SUBNET_1A" ]; then
    PRIVATE_SUBNET_1A=$(aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.10.0/24 --availability-zone ${AWS_REGION}a --query 'Subnet.SubnetId' --output text)
    aws ec2 create-tags --resources $PRIVATE_SUBNET_1A --tags Key=Name,Value=${PROJECT_NAME}-private-1a
fi

# Private Subnet 1b
PRIVATE_SUBNET_1B=$(aws ec2 describe-subnets --filters "Name=tag:Name,Values=${PROJECT_NAME}-private-1b" --query "Subnets[0].SubnetId" --output text 2>/dev/null)
if [ "$PRIVATE_SUBNET_1B" == "None" ] || [ -z "$PRIVATE_SUBNET_1B" ]; then
    PRIVATE_SUBNET_1B=$(aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.11.0/24 --availability-zone ${AWS_REGION}b --query 'Subnet.SubnetId' --output text)
    aws ec2 create-tags --resources $PRIVATE_SUBNET_1B --tags Key=Name,Value=${PROJECT_NAME}-private-1b
fi

report_success

# Create NAT Gateway
check_resource "NAT Gateway"
NAT_GW_ID=$(aws ec2 describe-nat-gateways --filter "Name=tag:Name,Values=${PROJECT_NAME}-nat" "Name=state,Values=available" --query "NatGateways[0].NatGatewayId" --output text 2>/dev/null)

if [ "$NAT_GW_ID" == "None" ] || [ -z "$NAT_GW_ID" ]; then
    echo "Creating Elastic IP for NAT Gateway..."
    EIP_ALLOC=$(aws ec2 allocate-address --domain vpc --query 'AllocationId' --output text)
    aws ec2 create-tags --resources $EIP_ALLOC --tags Key=Name,Value=${PROJECT_NAME}-nat-eip
    
    echo "Creating NAT Gateway..."
    NAT_GW_ID=$(aws ec2 create-nat-gateway --subnet-id $PUBLIC_SUBNET_1A --allocation-id $EIP_ALLOC --query 'NatGateway.NatGatewayId' --output text)
    aws ec2 create-tags --resources $NAT_GW_ID --tags Key=Name,Value=${PROJECT_NAME}-nat
    
    echo "Waiting for NAT Gateway to become available..."
    aws ec2 wait nat-gateway-available --nat-gateway-ids $NAT_GW_ID
    report_success
else
    echo "NAT Gateway already exists: $NAT_GW_ID"
fi

# Create Route Tables
echo "Setting up route tables..."

# Public Route Table
PUBLIC_RT=$(aws ec2 describe-route-tables --filters "Name=tag:Name,Values=${PROJECT_NAME}-public-rt" --query "RouteTables[0].RouteTableId" --output text 2>/dev/null)
if [ "$PUBLIC_RT" == "None" ] || [ -z "$PUBLIC_RT" ]; then
    PUBLIC_RT=$(aws ec2 create-route-table --vpc-id $VPC_ID --query 'RouteTable.RouteTableId' --output text)
    aws ec2 create-tags --resources $PUBLIC_RT --tags Key=Name,Value=${PROJECT_NAME}-public-rt
    aws ec2 create-route --route-table-id $PUBLIC_RT --destination-cidr-block 0.0.0.0/0 --gateway-id $IGW_ID
    aws ec2 associate-route-table --route-table-id $PUBLIC_RT --subnet-id $PUBLIC_SUBNET_1A
    aws ec2 associate-route-table --route-table-id $PUBLIC_RT --subnet-id $PUBLIC_SUBNET_1B
fi

# Private Route Table
PRIVATE_RT=$(aws ec2 describe-route-tables --filters "Name=tag:Name,Values=${PROJECT_NAME}-private-rt" --query "RouteTables[0].RouteTableId" --output text 2>/dev/null)
if [ "$PRIVATE_RT" == "None" ] || [ -z "$PRIVATE_RT" ]; then
    PRIVATE_RT=$(aws ec2 create-route-table --vpc-id $VPC_ID --query 'RouteTable.RouteTableId' --output text)
    aws ec2 create-tags --resources $PRIVATE_RT --tags Key=Name,Value=${PROJECT_NAME}-private-rt
    aws ec2 create-route --route-table-id $PRIVATE_RT --destination-cidr-block 0.0.0.0/0 --nat-gateway-id $NAT_GW_ID
    aws ec2 associate-route-table --route-table-id $PRIVATE_RT --subnet-id $PRIVATE_SUBNET_1A
    aws ec2 associate-route-table --route-table-id $PRIVATE_RT --subnet-id $PRIVATE_SUBNET_1B
fi

report_success

# Create Security Groups
echo "Creating security groups..."

# ALB Security Group
ALB_SG=$(aws ec2 describe-security-groups --filters "Name=tag:Name,Values=${PROJECT_NAME}-alb-sg" "Name=vpc-id,Values=$VPC_ID" --query "SecurityGroups[0].GroupId" --output text 2>/dev/null)
if [ "$ALB_SG" == "None" ] || [ -z "$ALB_SG" ]; then
    ALB_SG=$(aws ec2 create-security-group --group-name ${PROJECT_NAME}-alb-sg --description "Security group for ALB" --vpc-id $VPC_ID --query 'GroupId' --output text)
    aws ec2 create-tags --resources $ALB_SG --tags Key=Name,Value=${PROJECT_NAME}-alb-sg
    aws ec2 authorize-security-group-ingress --group-id $ALB_SG --protocol tcp --port 80 --cidr 0.0.0.0/0
    aws ec2 authorize-security-group-ingress --group-id $ALB_SG --protocol tcp --port 443 --cidr 0.0.0.0/0
fi

# ECS Tasks Security Group
ECS_SG=$(aws ec2 describe-security-groups --filters "Name=tag:Name,Values=${PROJECT_NAME}-ecs-sg" "Name=vpc-id,Values=$VPC_ID" --query "SecurityGroups[0].GroupId" --output text 2>/dev/null)
if [ "$ECS_SG" == "None" ] || [ -z "$ECS_SG" ]; then
    ECS_SG=$(aws ec2 create-security-group --group-name ${PROJECT_NAME}-ecs-sg --description "Security group for ECS tasks" --vpc-id $VPC_ID --query 'GroupId' --output text)
    aws ec2 create-tags --resources $ECS_SG --tags Key=Name,Value=${PROJECT_NAME}-ecs-sg
    aws ec2 authorize-security-group-ingress --group-id $ECS_SG --protocol tcp --port 80 --source-group $ALB_SG
    aws ec2 authorize-security-group-ingress --group-id $ECS_SG --protocol tcp --port 8000 --source-group $ALB_SG
    aws ec2 authorize-security-group-ingress --group-id $ECS_SG --protocol tcp --port 5555 --source-group $ALB_SG
    aws ec2 authorize-security-group-ingress --group-id $ECS_SG --protocol all --source-group $ECS_SG  # Allow internal communication
fi

# RDS Security Group
RDS_SG=$(aws ec2 describe-security-groups --filters "Name=tag:Name,Values=${PROJECT_NAME}-rds-sg" "Name=vpc-id,Values=$VPC_ID" --query "SecurityGroups[0].GroupId" --output text 2>/dev/null)
if [ "$RDS_SG" == "None" ] || [ -z "$RDS_SG" ]; then
    RDS_SG=$(aws ec2 create-security-group --group-name ${PROJECT_NAME}-rds-sg --description "Security group for RDS" --vpc-id $VPC_ID --query 'GroupId' --output text)
    aws ec2 create-tags --resources $RDS_SG --tags Key=Name,Value=${PROJECT_NAME}-rds-sg
    aws ec2 authorize-security-group-ingress --group-id $RDS_SG --protocol tcp --port 5432 --source-group $ECS_SG
fi

# Redis Security Group
REDIS_SG=$(aws ec2 describe-security-groups --filters "Name=tag:Name,Values=${PROJECT_NAME}-redis-sg" "Name=vpc-id,Values=$VPC_ID" --query "SecurityGroups[0].GroupId" --output text 2>/dev/null)
if [ "$REDIS_SG" == "None" ] || [ -z "$REDIS_SG" ]; then
    REDIS_SG=$(aws ec2 create-security-group --group-name ${PROJECT_NAME}-redis-sg --description "Security group for Redis" --vpc-id $VPC_ID --query 'GroupId' --output text)
    aws ec2 create-tags --resources $REDIS_SG --tags Key=Name,Value=${PROJECT_NAME}-redis-sg
    aws ec2 authorize-security-group-ingress --group-id $REDIS_SG --protocol tcp --port 6379 --source-group $ECS_SG
fi

# EFS Security Group
EFS_SG=$(aws ec2 describe-security-groups --filters "Name=tag:Name,Values=${PROJECT_NAME}-efs-sg" "Name=vpc-id,Values=$VPC_ID" --query "SecurityGroups[0].GroupId" --output text 2>/dev/null)
if [ "$EFS_SG" == "None" ] || [ -z "$EFS_SG" ]; then
    EFS_SG=$(aws ec2 create-security-group --group-name ${PROJECT_NAME}-efs-sg --description "Security group for EFS" --vpc-id $VPC_ID --query 'GroupId' --output text)
    aws ec2 create-tags --resources $EFS_SG --tags Key=Name,Value=${PROJECT_NAME}-efs-sg
    aws ec2 authorize-security-group-ingress --group-id $EFS_SG --protocol tcp --port 2049 --source-group $ECS_SG
fi

report_success

# Save configuration
echo "Saving configuration..."
cat > deploy-aws/config/infrastructure.env << EOF
# Infrastructure Configuration - Generated $(date)
export VPC_ID=$VPC_ID
export IGW_ID=$IGW_ID
export PUBLIC_SUBNET_1A=$PUBLIC_SUBNET_1A
export PUBLIC_SUBNET_1B=$PUBLIC_SUBNET_1B
export PRIVATE_SUBNET_1A=$PRIVATE_SUBNET_1A
export PRIVATE_SUBNET_1B=$PRIVATE_SUBNET_1B
export NAT_GW_ID=$NAT_GW_ID
export ALB_SG=$ALB_SG
export ECS_SG=$ECS_SG
export RDS_SG=$RDS_SG
export REDIS_SG=$REDIS_SG
export EFS_SG=$EFS_SG
export PUBLIC_RT=$PUBLIC_RT
export PRIVATE_RT=$PRIVATE_RT
EOF

echo ""
echo -e "${GREEN}=== Infrastructure setup complete! ===${NC}"
echo ""
echo "Next steps:"
echo "1. Run ./02-setup-databases.sh to create RDS and ElastiCache"
echo "2. Run ./03-setup-storage.sh to create EFS and S3"
echo "3. Run ./04-setup-ecs.sh to create ECS cluster and services"
echo ""
echo "Configuration saved to: deploy-aws/config/infrastructure.env"