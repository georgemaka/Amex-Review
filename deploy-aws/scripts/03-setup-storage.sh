#!/bin/bash
# Script 3: Set up EFS for shared file storage and optional S3 bucket
# Run after 02-setup-databases.sh

set -e

echo "=== AMEX Review Portal - Storage Setup ==="

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

# Create EFS File System
echo "Creating EFS file system..."
EFS_ID=$(aws efs describe-file-systems --query "FileSystems[?Name=='${PROJECT_NAME}-efs'].FileSystemId" --output text 2>/dev/null)

if [ -z "$EFS_ID" ] || [ "$EFS_ID" == "None" ]; then
    EFS_ID=$(aws efs create-file-system \
        --creation-token ${PROJECT_NAME}-efs \
        --performance-mode generalPurpose \
        --throughput-mode bursting \
        --encrypted \
        --tags Key=Name,Value=${PROJECT_NAME}-efs \
        --query 'FileSystemId' \
        --output text)
    
    echo "Waiting for EFS to be available..."
    aws efs wait file-system-available --file-system-id $EFS_ID
    echo -e "${GREEN}✓ EFS created: $EFS_ID${NC}"
else
    echo "EFS already exists: $EFS_ID"
fi

# Create EFS Mount Targets
echo "Creating EFS mount targets..."

# Mount target in private subnet 1a
MT_1A=$(aws efs describe-mount-targets --file-system-id $EFS_ID --query "MountTargets[?SubnetId=='$PRIVATE_SUBNET_1A'].MountTargetId" --output text 2>/dev/null)
if [ -z "$MT_1A" ] || [ "$MT_1A" == "None" ]; then
    MT_1A=$(aws efs create-mount-target \
        --file-system-id $EFS_ID \
        --subnet-id $PRIVATE_SUBNET_1A \
        --security-groups $EFS_SG \
        --query 'MountTargetId' \
        --output text)
    echo "Created mount target in subnet 1a: $MT_1A"
fi

# Mount target in private subnet 1b
MT_1B=$(aws efs describe-mount-targets --file-system-id $EFS_ID --query "MountTargets[?SubnetId=='$PRIVATE_SUBNET_1B'].MountTargetId" --output text 2>/dev/null)
if [ -z "$MT_1B" ] || [ "$MT_1B" == "None" ]; then
    MT_1B=$(aws efs create-mount-target \
        --file-system-id $EFS_ID \
        --subnet-id $PRIVATE_SUBNET_1B \
        --security-groups $EFS_SG \
        --query 'MountTargetId' \
        --output text)
    echo "Created mount target in subnet 1b: $MT_1B"
fi

# Wait for mount targets to be available
echo "Waiting for mount targets to be available..."
aws efs wait mount-target-available --mount-target-id $MT_1A 2>/dev/null || true
aws efs wait mount-target-available --mount-target-id $MT_1B 2>/dev/null || true

# Create EFS Access Point (optional, for better security)
echo "Creating EFS access point..."
AP_ID=$(aws efs describe-access-points --file-system-id $EFS_ID --query "AccessPoints[?Tags[?Key=='Name' && Value=='${PROJECT_NAME}-uploads']].AccessPointId" --output text 2>/dev/null)

if [ -z "$AP_ID" ] || [ "$AP_ID" == "None" ]; then
    AP_ID=$(aws efs create-access-point \
        --file-system-id $EFS_ID \
        --posix-user "Uid=1000,Gid=1000" \
        --root-directory "Path=/uploads,CreationInfo={OwnerUid=1000,OwnerGid=1000,Permissions=755}" \
        --tags Key=Name,Value=${PROJECT_NAME}-uploads \
        --query 'AccessPointId' \
        --output text)
    echo -e "${GREEN}✓ EFS access point created: $AP_ID${NC}"
fi

# Create S3 Bucket (optional, for archival)
echo ""
echo -e "${YELLOW}Creating S3 bucket for file archival (optional)...${NC}"
S3_BUCKET="${PROJECT_NAME}-files-${AWS_REGION}"

if ! aws s3api head-bucket --bucket $S3_BUCKET 2>/dev/null; then
    aws s3api create-bucket \
        --bucket $S3_BUCKET \
        --region $AWS_REGION \
        --acl private
    
    # Enable versioning
    aws s3api put-bucket-versioning \
        --bucket $S3_BUCKET \
        --versioning-configuration Status=Enabled
    
    # Enable server-side encryption
    aws s3api put-bucket-encryption \
        --bucket $S3_BUCKET \
        --server-side-encryption-configuration '{
            "Rules": [{
                "ApplyServerSideEncryptionByDefault": {
                    "SSEAlgorithm": "AES256"
                }
            }]
        }'
    
    # Block public access
    aws s3api put-public-access-block \
        --bucket $S3_BUCKET \
        --public-access-block-configuration \
        "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
    
    # Create lifecycle policy for cost optimization
    aws s3api put-bucket-lifecycle-configuration \
        --bucket $S3_BUCKET \
        --lifecycle-configuration '{
            "Rules": [{
                "ID": "ArchiveOldFiles",
                "Status": "Enabled",
                "Prefix": "statements/",
                "Transitions": [{
                    "Days": 90,
                    "StorageClass": "GLACIER"
                }]
            }]
        }'
    
    echo -e "${GREEN}✓ S3 bucket created: $S3_BUCKET${NC}"
else
    echo "S3 bucket already exists: $S3_BUCKET"
fi

# Create IAM policy for ECS tasks to access storage
echo "Creating IAM policy for storage access..."
POLICY_NAME="${PROJECT_NAME}-storage-policy"

cat > /tmp/storage-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "elasticfilesystem:ClientMount",
                "elasticfilesystem:ClientWrite",
                "elasticfilesystem:DescribeFileSystems",
                "elasticfilesystem:DescribeMountTargets"
            ],
            "Resource": "arn:aws:elasticfilesystem:${AWS_REGION}:*:file-system/${EFS_ID}"
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:ListBucket",
                "s3:GetBucketLocation"
            ],
            "Resource": "arn:aws:s3:::${S3_BUCKET}"
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject"
            ],
            "Resource": "arn:aws:s3:::${S3_BUCKET}/*"
        }
    ]
}
EOF

# Create or update the policy
POLICY_ARN=$(aws iam list-policies --query "Policies[?PolicyName=='$POLICY_NAME'].Arn" --output text)
if [ -z "$POLICY_ARN" ] || [ "$POLICY_ARN" == "None" ]; then
    POLICY_ARN=$(aws iam create-policy \
        --policy-name $POLICY_NAME \
        --policy-document file:///tmp/storage-policy.json \
        --description "Policy for ECS tasks to access EFS and S3" \
        --query 'Policy.Arn' \
        --output text)
    echo -e "${GREEN}✓ IAM policy created${NC}"
else
    # Update existing policy
    POLICY_VERSION=$(aws iam get-policy --policy-arn $POLICY_ARN --query 'Policy.DefaultVersionId' --output text)
    aws iam create-policy-version \
        --policy-arn $POLICY_ARN \
        --policy-document file:///tmp/storage-policy.json \
        --set-as-default
    echo "IAM policy updated"
fi

rm -f /tmp/storage-policy.json

# Update task definitions with EFS ID
echo "Updating task definition files with EFS ID..."
for task_def in backend celery; do
    sed -i.bak "s/fs-xxxxxxxxx/$EFS_ID/g" deploy-aws/task-definitions/${task_def}.json
done

# Save configuration
cat >> deploy-aws/config/infrastructure.env << EOF

# Storage Configuration - Generated $(date)
export EFS_ID=$EFS_ID
export EFS_AP_ID=$AP_ID
export S3_BUCKET=$S3_BUCKET
export STORAGE_POLICY_ARN=$POLICY_ARN
EOF

echo ""
echo -e "${GREEN}=== Storage setup complete! ===${NC}"
echo ""
echo "Storage resources created:"
echo "- EFS File System: $EFS_ID"
echo "- EFS Access Point: $AP_ID"
echo "- S3 Bucket: $S3_BUCKET"
echo ""
echo "Next step: Run ./04-setup-ecs.sh"