# AWS ECS Fargate Deployment Guide for AMEX Coding Portal

## Overview
This guide details deploying the AMEX Coding Portal on AWS ECS Fargate as part of the Sukut ecosystem. ECS Fargate provides serverless container hosting with better scalability, reliability, and integration with AWS services compared to Lightsail, making it ideal for your growing multi-app ecosystem.

## Why ECS Fargate Instead of Lightsail?

### Advantages for Your Use Case:
- **Multi-App Support**: Perfect for your ecosystem with multiple applications
- **Auto-Scaling**: Automatically scales based on load (handles usage spikes)
- **No Server Management**: Fully serverless - AWS manages the infrastructure
- **Better Integration**: Native AWS service integration (RDS, ElastiCache, ALB)
- **Production-Ready**: Built-in high availability and fault tolerance
- **Granular Billing**: Pay only for resources used (CPU/Memory per second)
- **Advanced Monitoring**: CloudWatch integration with detailed metrics
- **Service Discovery**: Easy inter-service communication
- **Rolling Updates**: Zero-downtime deployments

### Cost Comparison:
- **Lightsail**: Fixed $20-22/month (limited scaling)
- **ECS Fargate**: ~$50-100/month (scales with usage, includes all services)

## AWS Account Information
- **AWS Account ID**: 322325783793
- **IAM User**: portal-admin (needs additional ECS permissions)
- **Primary Region**: us-east-1
- **Backup Region**: us-west-2 (for disaster recovery)
- **Parent Domain**: sukutapps.com
- **Target URL**: https://amex.sukutapps.com
- **Route 53 Hosted Zone ID**: Z0860330TU6D8FUIUUAJ

## Architecture Overview

```
Internet
    │
    ├── Route 53 (DNS)
    │
    ├── CloudFront (CDN) - Optional
    │
    └── Application Load Balancer (ALB)
         │
         ├── Target Group: Frontend (Port 80/443)
         │   └── ECS Service: Frontend (Fargate)
         │
         ├── Target Group: Backend (Port 8000)
         │   └── ECS Service: Backend (Fargate)
         │
         └── Target Group: Flower (Port 5555)
             └── ECS Service: Flower (Fargate)

Internal Services:
    ├── ECS Service: Celery Worker (Fargate)
    ├── RDS PostgreSQL (Multi-AZ)
    ├── ElastiCache Redis (Cluster Mode)
    └── EFS (Shared file storage for PDFs)
```

## Prerequisites

1. **AWS CLI v2** installed and configured
2. **Docker** installed locally
3. **Terraform** (optional but recommended)
4. **GitHub repository** with your code
5. **Basic AWS knowledge** (we'll guide you through everything)

## Step-by-Step Deployment Guide

### Step 1: Prepare AWS Account and Permissions

```bash
# Verify your AWS access
aws sts get-caller-identity

# Create/update IAM permissions for portal-admin
aws iam attach-user-policy --user-name portal-admin --policy-arn arn:aws:iam::aws:policy/AmazonECS_FullAccess
aws iam attach-user-policy --user-name portal-admin --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryFullAccess
aws iam attach-user-policy --user-name portal-admin --policy-arn arn:aws:iam::aws:policy/AmazonRDSFullAccess
aws iam attach-user-policy --user-name portal-admin --policy-arn arn:aws:iam::aws:policy/AmazonElastiCacheFullAccess
aws iam attach-user-policy --user-name portal-admin --policy-arn arn:aws:iam::aws:policy/ElasticLoadBalancingFullAccess
aws iam attach-user-policy --user-name portal-admin --policy-arn arn:aws:iam::aws:policy/AmazonVPCFullAccess
```

### Step 2: Create VPC and Networking

```bash
# Create VPC with public and private subnets
aws ec2 create-vpc --cidr-block 10.0.0.0/16 --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=amex-vpc}]'

# Note the VPC ID from output, then create subnets
VPC_ID=vpc-xxxxxxxxx  # Replace with your VPC ID

# Create public subnets (for ALB)
aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.1.0/24 --availability-zone us-east-1a --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=amex-public-1a}]'
aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.2.0/24 --availability-zone us-east-1b --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=amex-public-1b}]'

# Create private subnets (for ECS tasks)
aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.10.0/24 --availability-zone us-east-1a --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=amex-private-1a}]'
aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.11.0/24 --availability-zone us-east-1b --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=amex-private-1b}]'

# Create Internet Gateway
aws ec2 create-internet-gateway --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=amex-igw}]'
aws ec2 attach-internet-gateway --vpc-id $VPC_ID --internet-gateway-id igw-xxxxxxxxx

# Create NAT Gateway for private subnets
aws ec2 allocate-address --domain vpc --tag-specifications 'ResourceType=elastic-ip,Tags=[{Key=Name,Value=amex-nat-eip}]'
aws ec2 create-nat-gateway --subnet-id subnet-public-1a-id --allocation-id eipalloc-xxxxxxxxx
```

### Step 3: Create ECR Repositories

```bash
# Create ECR repositories for each service
aws ecr create-repository --repository-name amex-review/backend --region us-east-1
aws ecr create-repository --repository-name amex-review/frontend --region us-east-1
aws ecr create-repository --repository-name amex-review/nginx --region us-east-1

# Get login token
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 322325783793.dkr.ecr.us-east-1.amazonaws.com
```

### Step 4: Build and Push Docker Images

```bash
# Clone your repository
git clone https://github.com/YOUR_USERNAME/amex-coding-portal.git
cd amex-coding-portal

# Build and push backend
docker build -t amex-review/backend ./backend
docker tag amex-review/backend:latest 322325783793.dkr.ecr.us-east-1.amazonaws.com/amex-review/backend:latest
docker push 322325783793.dkr.ecr.us-east-1.amazonaws.com/amex-review/backend:latest

# Build and push frontend
docker build -t amex-review/frontend ./frontend --build-arg REACT_APP_API_URL=https://amex.sukutapps.com
docker tag amex-review/frontend:latest 322325783793.dkr.ecr.us-east-1.amazonaws.com/amex-review/frontend:latest
docker push 322325783793.dkr.ecr.us-east-1.amazonaws.com/amex-review/frontend:latest
```

### Step 5: Create RDS Database

```bash
# Create DB subnet group
aws rds create-db-subnet-group \
  --db-subnet-group-name amex-db-subnet-group \
  --db-subnet-group-description "Subnet group for AMEX RDS" \
  --subnet-ids subnet-private-1a-id subnet-private-1b-id

# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier amex-postgres \
  --db-instance-class db.t3.small \
  --engine postgres \
  --engine-version 15.3 \
  --master-username postgres \
  --master-user-password YourSecurePassword123! \
  --allocated-storage 20 \
  --db-subnet-group-name amex-db-subnet-group \
  --vpc-security-group-ids sg-xxxxxxxxx \
  --backup-retention-period 7 \
  --preferred-backup-window "03:00-04:00" \
  --preferred-maintenance-window "sun:04:00-sun:05:00" \
  --multi-az \
  --storage-encrypted
```

### Step 6: Create ElastiCache Redis

```bash
# Create cache subnet group
aws elasticache create-cache-subnet-group \
  --cache-subnet-group-name amex-cache-subnet-group \
  --cache-subnet-group-description "Subnet group for AMEX Redis" \
  --subnet-ids subnet-private-1a-id subnet-private-1b-id

# Create Redis cluster
aws elasticache create-cache-cluster \
  --cache-cluster-id amex-redis \
  --engine redis \
  --cache-node-type cache.t3.micro \
  --num-cache-nodes 1 \
  --cache-subnet-group-name amex-cache-subnet-group \
  --security-group-ids sg-xxxxxxxxx \
  --preferred-maintenance-window "sun:05:00-sun:06:00"
```

### Step 7: Create EFS for Shared Storage

```bash
# Create EFS filesystem
aws efs create-file-system \
  --creation-token amex-efs \
  --performance-mode generalPurpose \
  --throughput-mode bursting \
  --encrypted \
  --tags Key=Name,Value=amex-efs

# Create mount targets in each private subnet
aws efs create-mount-target \
  --file-system-id fs-xxxxxxxxx \
  --subnet-id subnet-private-1a-id \
  --security-groups sg-xxxxxxxxx
```

### Step 8: Create ECS Cluster

```bash
# Create ECS cluster
aws ecs create-cluster \
  --cluster-name amex-review-cluster \
  --capacity-providers FARGATE FARGATE_SPOT \
  --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1,base=1
```

### Step 9: Create Task Definitions

Create `task-definitions/backend.json`:
```json
{
  "family": "amex-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::322325783793:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::322325783793:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "322325783793.dkr.ecr.us-east-1.amazonaws.com/amex-review/backend:latest",
      "portMappings": [
        {
          "containerPort": 8000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "ENVIRONMENT", "value": "production"},
        {"name": "CORS_ORIGINS", "value": "[\"https://amex.sukutapps.com\"]"}
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:322325783793:secret:amex/database-url"
        },
        {
          "name": "REDIS_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:322325783793:secret:amex/redis-url"
        },
        {
          "name": "SECRET_KEY",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:322325783793:secret:amex/secret-key"
        }
      ],
      "mountPoints": [
        {
          "sourceVolume": "efs-storage",
          "containerPath": "/app/uploads"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/amex-review/backend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:8000/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ],
  "volumes": [
    {
      "name": "efs-storage",
      "efsVolumeConfiguration": {
        "fileSystemId": "fs-xxxxxxxxx",
        "transitEncryption": "ENABLED"
      }
    }
  ]
}
```

Register task definitions:
```bash
aws ecs register-task-definition --cli-input-json file://task-definitions/backend.json
aws ecs register-task-definition --cli-input-json file://task-definitions/frontend.json
aws ecs register-task-definition --cli-input-json file://task-definitions/celery.json
aws ecs register-task-definition --cli-input-json file://task-definitions/flower.json
```

### Step 10: Create Application Load Balancer

```bash
# Create ALB
aws elbv2 create-load-balancer \
  --name amex-review-alb \
  --subnets subnet-public-1a-id subnet-public-1b-id \
  --security-groups sg-alb-id \
  --scheme internet-facing \
  --type application \
  --ip-address-type ipv4

# Create target groups
aws elbv2 create-target-group \
  --name amex-backend-tg \
  --protocol HTTP \
  --port 8000 \
  --vpc-id $VPC_ID \
  --target-type ip \
  --health-check-path /health

aws elbv2 create-target-group \
  --name amex-frontend-tg \
  --protocol HTTP \
  --port 80 \
  --vpc-id $VPC_ID \
  --target-type ip \
  --health-check-path /

# Create listeners
aws elbv2 create-listener \
  --load-balancer-arn arn:aws:elasticloadbalancing:... \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=arn:aws:acm:... \
  --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:...
```

### Step 11: Create ECS Services

```bash
# Create backend service
aws ecs create-service \
  --cluster amex-review-cluster \
  --service-name backend \
  --task-definition amex-backend:1 \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-private-1a-id,subnet-private-1b-id],securityGroups=[sg-ecs-tasks-id],assignPublicIp=DISABLED}" \
  --load-balancers targetGroupArn=arn:aws:elasticloadbalancing:...,containerName=backend,containerPort=8000 \
  --health-check-grace-period-seconds 60

# Create frontend service
aws ecs create-service \
  --cluster amex-review-cluster \
  --service-name frontend \
  --task-definition amex-frontend:1 \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-private-1a-id,subnet-private-1b-id],securityGroups=[sg-ecs-tasks-id],assignPublicIp=DISABLED}" \
  --load-balancers targetGroupArn=arn:aws:elasticloadbalancing:...,containerName=frontend,containerPort=80

# Create Celery worker service (no load balancer)
aws ecs create-service \
  --cluster amex-review-cluster \
  --service-name celery-worker \
  --task-definition amex-celery:1 \
  --desired-count 1 \
  --launch-type FARGATE_SPOT \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-private-1a-id,subnet-private-1b-id],securityGroups=[sg-ecs-tasks-id],assignPublicIp=DISABLED}"
```

### Step 12: Configure Auto-Scaling

```bash
# Register scalable targets
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/amex-review-cluster/backend \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 1 \
  --max-capacity 10

# Create scaling policies
aws application-autoscaling put-scaling-policy \
  --policy-name backend-cpu-scaling \
  --service-namespace ecs \
  --resource-id service/amex-review-cluster/backend \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration '{
    "TargetValue": 70.0,
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
    },
    "ScaleInCooldown": 300,
    "ScaleOutCooldown": 60
  }'
```

### Step 13: Set Up CloudWatch Monitoring

```bash
# Create CloudWatch dashboard
aws cloudwatch put-dashboard \
  --dashboard-name AMEX-Review-Dashboard \
  --dashboard-body file://cloudwatch-dashboard.json

# Create alarms
aws cloudwatch put-metric-alarm \
  --alarm-name amex-backend-high-cpu \
  --alarm-description "Alarm when backend CPU exceeds 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2
```

### Step 14: Configure Route 53

```bash
# Create Route 53 record for ALB
aws route53 change-resource-record-sets \
  --hosted-zone-id Z0860330TU6D8FUIUUAJ \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "amex.sukutapps.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "ALB_HOSTED_ZONE_ID",
          "DNSName": "amex-review-alb-xxxxxxxxx.us-east-1.elb.amazonaws.com",
          "EvaluateTargetHealth": true
        }
      }
    }]
  }'
```

### Step 15: Deploy with CI/CD (GitHub Actions)

Create `.github/workflows/deploy-ecs.yml`:
```yaml
name: Deploy to ECS

on:
  push:
    branches: [main]

env:
  AWS_REGION: us-east-1
  ECR_REPOSITORY_BACKEND: amex-review/backend
  ECR_REPOSITORY_FRONTEND: amex-review/frontend
  ECS_CLUSTER: amex-review-cluster
  ECS_SERVICE_BACKEND: backend
  ECS_SERVICE_FRONTEND: frontend

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1

      - name: Build, tag, and push backend image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY_BACKEND:$IMAGE_TAG ./backend
          docker push $ECR_REGISTRY/$ECR_REPOSITORY_BACKEND:$IMAGE_TAG
          docker tag $ECR_REGISTRY/$ECR_REPOSITORY_BACKEND:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY_BACKEND:latest
          docker push $ECR_REGISTRY/$ECR_REPOSITORY_BACKEND:latest

      - name: Build, tag, and push frontend image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY_FRONTEND:$IMAGE_TAG ./frontend \
            --build-arg REACT_APP_API_URL=https://amex.sukutapps.com
          docker push $ECR_REGISTRY/$ECR_REPOSITORY_FRONTEND:$IMAGE_TAG
          docker tag $ECR_REGISTRY/$ECR_REPOSITORY_FRONTEND:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY_FRONTEND:latest
          docker push $ECR_REGISTRY/$ECR_REPOSITORY_FRONTEND:latest

      - name: Update ECS services
        run: |
          aws ecs update-service --cluster ${{ env.ECS_CLUSTER }} --service ${{ env.ECS_SERVICE_BACKEND }} --force-new-deployment
          aws ecs update-service --cluster ${{ env.ECS_CLUSTER }} --service ${{ env.ECS_SERVICE_FRONTEND }} --force-new-deployment
```

## Security Best Practices

### 1. Secrets Management
```bash
# Store all sensitive data in AWS Secrets Manager
aws secretsmanager create-secret --name amex/database-url --secret-string "postgresql://user:pass@host/db"
aws secretsmanager create-secret --name amex/redis-url --secret-string "redis://redis-cluster.aws.com:6379"
aws secretsmanager create-secret --name amex/secret-key --secret-string "your-very-long-random-secret-key"
```

### 2. Network Security
- Use private subnets for all ECS tasks
- ALB in public subnets only
- Security groups with least privilege
- VPC Flow Logs enabled
- AWS WAF on ALB (optional)

### 3. Container Security
- Regular image scanning in ECR
- Non-root containers
- Read-only root filesystems where possible
- IMDSv2 enforced

## Cost Optimization

### Estimated Monthly Costs:
- **ECS Fargate Tasks**: ~$40-60 (varies with usage)
  - Backend: 2x (0.5 vCPU, 1GB) = ~$20
  - Frontend: 2x (0.25 vCPU, 0.5GB) = ~$10
  - Celery: 1x (0.5 vCPU, 1GB) = ~$10
- **RDS PostgreSQL**: ~$25 (db.t3.small, Multi-AZ)
- **ElastiCache Redis**: ~$15 (cache.t3.micro)
- **Application Load Balancer**: ~$20
- **EFS Storage**: ~$5 (depends on usage)
- **Data Transfer**: ~$10-20
- **Total**: ~$100-150/month

### Cost Saving Tips:
1. Use Fargate Spot for Celery workers (70% savings)
2. Schedule scale-down during off-hours
3. Use Reserved Instances for RDS (up to 50% savings)
4. Enable S3 lifecycle policies for logs
5. Monitor with Cost Explorer and set budget alerts

## Monitoring and Maintenance

### Key Metrics to Monitor:
1. **ECS Service Health**: Task count, CPU/Memory utilization
2. **ALB Health**: Request count, error rate, latency
3. **RDS Performance**: CPU, connections, storage
4. **Application Logs**: Errors, warnings, performance

### Maintenance Tasks:
```bash
# View service status
aws ecs describe-services --cluster amex-review-cluster --services backend frontend

# Check task logs
aws logs tail /ecs/amex-review/backend --follow

# Force service update
aws ecs update-service --cluster amex-review-cluster --service backend --force-new-deployment

# Scale services
aws ecs update-service --cluster amex-review-cluster --service backend --desired-count 3
```

## Disaster Recovery

### Backup Strategy:
1. **RDS**: Automated daily backups (7-day retention)
2. **EFS**: AWS Backup for file storage
3. **Code**: Git repository
4. **Infrastructure**: Terraform state in S3

### Multi-Region Setup (Optional):
```bash
# Create read replica in us-west-2
aws rds create-db-instance-read-replica \
  --db-instance-identifier amex-postgres-replica \
  --source-db-instance-identifier amex-postgres \
  --db-instance-class db.t3.small \
  --publicly-accessible false
```

## Troubleshooting Guide

### Common Issues:

1. **Tasks failing to start**:
```bash
# Check task stopped reason
aws ecs describe-tasks --cluster amex-review-cluster --tasks [TASK-ARN]

# Common causes:
# - Image pull errors: Check ECR permissions
# - Resource constraints: Increase CPU/memory
# - Health check failures: Extend grace period
```

2. **Database connection issues**:
```bash
# Test from ECS task
aws ecs execute-command \
  --cluster amex-review-cluster \
  --task [TASK-ARN] \
  --container backend \
  --interactive \
  --command "/bin/bash"

# Inside container:
nc -zv postgres-endpoint.rds.amazonaws.com 5432
```

3. **High costs**:
```bash
# Check resource utilization
aws cloudwatch get-metric-statistics \
  --namespace AWS/ECS \
  --metric-name CPUUtilization \
  --dimensions Name=ServiceName,Value=backend Name=ClusterName,Value=amex-review-cluster \
  --statistics Average \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600
```

## Migration from Lightsail

If migrating from existing Lightsail deployment:

1. **Database Migration**:
```bash
# Export from Lightsail
pg_dump -h lightsail-instance-ip -U postgres amex_coding > backup.sql

# Import to RDS
psql -h rds-endpoint.amazonaws.com -U postgres amex_coding < backup.sql
```

2. **File Migration**:
```bash
# Copy files from Lightsail to EFS
scp -r lightsail-user@lightsail-ip:/uploads/* /mnt/efs/uploads/
```

3. **DNS Cutover**:
- Update Route 53 to point to new ALB
- Monitor for issues
- Keep Lightsail running for 24-48 hours as backup

## Next Steps

1. **Complete infrastructure setup** using provided commands
2. **Deploy application** and verify functionality
3. **Configure monitoring** and alerts
4. **Document any customizations** for your team
5. **Plan for future apps** in the ecosystem

## Support Resources

- **AWS ECS Documentation**: https://docs.aws.amazon.com/ecs/
- **AWS Well-Architected Framework**: https://aws.amazon.com/architecture/well-architected/
- **Container Best Practices**: https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/
- **AWS Support**: Available through your AWS account

Remember: Start with the basic setup and optimize based on actual usage patterns. ECS Fargate's flexibility allows you to adjust resources without downtime.