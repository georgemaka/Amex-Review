#!/bin/bash
# Script 2: Set up RDS PostgreSQL and ElastiCache Redis
# Run after 01-setup-infrastructure.sh

set -e

echo "=== AMEX Review Portal - Database Setup ==="

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

# Function to generate secure password
generate_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-25
}

# Create DB Subnet Group
echo "Creating DB subnet group..."
aws rds describe-db-subnet-groups --db-subnet-group-name ${PROJECT_NAME}-db-subnet-group &>/dev/null || \
aws rds create-db-subnet-group \
    --db-subnet-group-name ${PROJECT_NAME}-db-subnet-group \
    --db-subnet-group-description "Subnet group for AMEX RDS" \
    --subnet-ids $PRIVATE_SUBNET_1A $PRIVATE_SUBNET_1B \
    --tags Key=Name,Value=${PROJECT_NAME}-db-subnet-group

# Generate RDS password
RDS_PASSWORD=$(generate_password)
echo -e "${YELLOW}Generated RDS password. Saving to Secrets Manager...${NC}"

# Store RDS password in Secrets Manager
aws secretsmanager create-secret \
    --name ${PROJECT_NAME}/rds-password \
    --description "RDS master password for AMEX Review" \
    --secret-string "$RDS_PASSWORD" &>/dev/null || \
aws secretsmanager update-secret \
    --secret-id ${PROJECT_NAME}/rds-password \
    --secret-string "$RDS_PASSWORD"

# Create RDS PostgreSQL Instance
echo "Creating RDS PostgreSQL instance..."
RDS_INSTANCE="${PROJECT_NAME}-postgres"

if ! aws rds describe-db-instances --db-instance-identifier $RDS_INSTANCE &>/dev/null; then
    aws rds create-db-instance \
        --db-instance-identifier $RDS_INSTANCE \
        --db-instance-class db.t3.small \
        --engine postgres \
        --engine-version 15.3 \
        --master-username postgres \
        --master-user-password "$RDS_PASSWORD" \
        --allocated-storage 20 \
        --storage-type gp3 \
        --storage-encrypted \
        --db-subnet-group-name ${PROJECT_NAME}-db-subnet-group \
        --vpc-security-group-ids $RDS_SG \
        --backup-retention-period 7 \
        --preferred-backup-window "03:00-04:00" \
        --preferred-maintenance-window "sun:04:00-sun:05:00" \
        --multi-az \
        --no-publicly-accessible \
        --tags Key=Name,Value=${PROJECT_NAME}-postgres
    
    echo "Waiting for RDS instance to be available (this may take 5-10 minutes)..."
    aws rds wait db-instance-available --db-instance-identifier $RDS_INSTANCE
    echo -e "${GREEN}✓ RDS instance created${NC}"
else
    echo "RDS instance already exists"
fi

# Get RDS endpoint
RDS_ENDPOINT=$(aws rds describe-db-instances \
    --db-instance-identifier $RDS_INSTANCE \
    --query 'DBInstances[0].Endpoint.Address' \
    --output text)

echo "RDS Endpoint: $RDS_ENDPOINT"

# Create ElastiCache Subnet Group
echo "Creating ElastiCache subnet group..."
aws elasticache describe-cache-subnet-groups --cache-subnet-group-name ${PROJECT_NAME}-cache-subnet-group &>/dev/null || \
aws elasticache create-cache-subnet-group \
    --cache-subnet-group-name ${PROJECT_NAME}-cache-subnet-group \
    --cache-subnet-group-description "Subnet group for AMEX Redis" \
    --subnet-ids $PRIVATE_SUBNET_1A $PRIVATE_SUBNET_1B

# Create ElastiCache Redis Cluster
echo "Creating ElastiCache Redis cluster..."
REDIS_CLUSTER="${PROJECT_NAME}-redis"

if ! aws elasticache describe-cache-clusters --cache-cluster-id $REDIS_CLUSTER &>/dev/null; then
    aws elasticache create-cache-cluster \
        --cache-cluster-id $REDIS_CLUSTER \
        --engine redis \
        --cache-node-type cache.t3.micro \
        --num-cache-nodes 1 \
        --cache-subnet-group-name ${PROJECT_NAME}-cache-subnet-group \
        --security-group-ids $REDIS_SG \
        --preferred-maintenance-window "sun:05:00-sun:06:00" \
        --tags Key=Name,Value=${PROJECT_NAME}-redis
    
    echo "Waiting for Redis cluster to be available..."
    aws elasticache wait cache-cluster-available --cache-cluster-id $REDIS_CLUSTER
    echo -e "${GREEN}✓ Redis cluster created${NC}"
else
    echo "Redis cluster already exists"
fi

# Get Redis endpoint
REDIS_ENDPOINT=$(aws elasticache describe-cache-clusters \
    --cache-cluster-id $REDIS_CLUSTER \
    --show-cache-node-info \
    --query 'CacheClusters[0].CacheNodes[0].Endpoint.Address' \
    --output text)

REDIS_PORT=$(aws elasticache describe-cache-clusters \
    --cache-cluster-id $REDIS_CLUSTER \
    --show-cache-node-info \
    --query 'CacheClusters[0].CacheNodes[0].Endpoint.Port' \
    --output text)

echo "Redis Endpoint: $REDIS_ENDPOINT:$REDIS_PORT"

# Create secrets in Secrets Manager
echo "Storing database URLs in Secrets Manager..."

# Database URL
DATABASE_URL="postgresql://postgres:${RDS_PASSWORD}@${RDS_ENDPOINT}:5432/amex_coding"
aws secretsmanager create-secret \
    --name ${PROJECT_NAME}/database-url \
    --description "Database URL for AMEX Review" \
    --secret-string "$DATABASE_URL" &>/dev/null || \
aws secretsmanager update-secret \
    --secret-id ${PROJECT_NAME}/database-url \
    --secret-string "$DATABASE_URL"

# Redis URL
REDIS_URL="redis://${REDIS_ENDPOINT}:${REDIS_PORT}/0"
aws secretsmanager create-secret \
    --name ${PROJECT_NAME}/redis-url \
    --description "Redis URL for AMEX Review" \
    --secret-string "$REDIS_URL" &>/dev/null || \
aws secretsmanager update-secret \
    --secret-id ${PROJECT_NAME}/redis-url \
    --secret-string "$REDIS_URL"

# Generate and store secret key
SECRET_KEY=$(openssl rand -base64 64 | tr -d '\n')
aws secretsmanager create-secret \
    --name ${PROJECT_NAME}/secret-key \
    --description "Secret key for AMEX Review" \
    --secret-string "$SECRET_KEY" &>/dev/null || \
aws secretsmanager update-secret \
    --secret-id ${PROJECT_NAME}/secret-key \
    --secret-string "$SECRET_KEY"

# Save configuration
cat >> deploy-aws/config/infrastructure.env << EOF

# Database Configuration - Generated $(date)
export RDS_INSTANCE=$RDS_INSTANCE
export RDS_ENDPOINT=$RDS_ENDPOINT
export REDIS_CLUSTER=$REDIS_CLUSTER
export REDIS_ENDPOINT=$REDIS_ENDPOINT
export REDIS_PORT=$REDIS_PORT
EOF

echo ""
echo -e "${GREEN}=== Database setup complete! ===${NC}"
echo ""
echo "Database endpoints:"
echo "- RDS PostgreSQL: $RDS_ENDPOINT"
echo "- ElastiCache Redis: $REDIS_ENDPOINT:$REDIS_PORT"
echo ""
echo "Secrets stored in AWS Secrets Manager:"
echo "- ${PROJECT_NAME}/database-url"
echo "- ${PROJECT_NAME}/redis-url"
echo "- ${PROJECT_NAME}/secret-key"
echo "- ${PROJECT_NAME}/rds-password"
echo ""
echo "Next step: Run ./03-setup-storage.sh"