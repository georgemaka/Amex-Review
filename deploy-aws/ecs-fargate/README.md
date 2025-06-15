# ECS Fargate Deployment Guide for Amex Review Application

This guide provides step-by-step instructions for deploying the Amex Review application to AWS ECS Fargate. It's designed for beginners and covers all aspects of the deployment process.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Step 1: AWS Account Setup](#step-1-aws-account-setup)
4. [Step 2: Install Required Tools](#step-2-install-required-tools)
5. [Step 3: Configure AWS Credentials](#step-3-configure-aws-credentials)
6. [Step 4: Create ECR Repositories](#step-4-create-ecr-repositories)
7. [Step 5: Build and Push Docker Images](#step-5-build-and-push-docker-images)
8. [Step 6: Deploy Infrastructure with Terraform](#step-6-deploy-infrastructure-with-terraform)
9. [Step 7: Deploy Application](#step-7-deploy-application)
10. [Step 8: Verify Deployment](#step-8-verify-deployment)
11. [Step 9: Set Up CI/CD](#step-9-set-up-cicd)
12. [Troubleshooting](#troubleshooting)
13. [Cost Optimization](#cost-optimization)

## Prerequisites

Before starting, ensure you have:
- An AWS account with billing enabled
- A domain name (optional, for custom domain)
- Basic understanding of Docker and AWS concepts
- Git installed on your local machine

## Architecture Overview

The deployment includes:
- **ECS Fargate Cluster**: Serverless container hosting
- **Application Load Balancer (ALB)**: Traffic distribution
- **RDS PostgreSQL**: Production database
- **ElastiCache Redis**: Caching and Celery broker
- **EFS**: Shared file storage for PDFs
- **Secrets Manager**: Secure credential storage
- **CloudWatch**: Logging and monitoring
- **VPC with public/private subnets**: Network isolation

Services deployed:
1. **Frontend**: React application (Port 80/443)
2. **Backend**: FastAPI application (Port 8000)
3. **Celery Worker**: Async task processing
4. **Flower**: Celery monitoring (Port 5555)

## Step 1: AWS Account Setup

1. **Create an AWS Account**:
   - Go to https://aws.amazon.com
   - Click "Create an AWS Account"
   - Follow the registration process
   - Add a payment method

2. **Enable Required Services**:
   - Log into AWS Console
   - Ensure these services are available in your region:
     - ECS, ECR, RDS, ElastiCache, ALB, VPC, CloudWatch

3. **Create an IAM User**:
   ```bash
   # In AWS Console:
   # 1. Go to IAM → Users → Add User
   # 2. Username: amex-deploy-user
   # 3. Access type: Programmatic access
   # 4. Attach policy: AdministratorAccess (for initial setup)
   # 5. Save the Access Key ID and Secret Access Key
   ```

## Step 2: Install Required Tools

### On macOS:
```bash
# Install Homebrew if not installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install AWS CLI
brew install awscli

# Install Terraform
brew tap hashicorp/tap
brew install hashicorp/tap/terraform

# Install Docker Desktop
# Download from: https://www.docker.com/products/docker-desktop

# Install Session Manager plugin
curl "https://s3.amazonaws.com/session-manager-downloads/plugin/latest/mac/sessionmanager-bundle.zip" -o "sessionmanager-bundle.zip"
unzip sessionmanager-bundle.zip
sudo ./sessionmanager-bundle/install -i /usr/local/sessionmanagerplugin -b /usr/local/bin/session-manager-plugin
```

### On Windows:
```powershell
# Install Chocolatey package manager
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install tools
choco install awscli terraform docker-desktop -y
```

### On Linux (Ubuntu/Debian):
```bash
# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Install Terraform
wget -O- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install terraform

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

## Step 3: Configure AWS Credentials

```bash
# Configure AWS CLI with your credentials
aws configure

# Enter when prompted:
# AWS Access Key ID: [Your Access Key]
# AWS Secret Access Key: [Your Secret Key]
# Default region name: us-west-2 (or your preferred region)
# Default output format: json

# Verify configuration
aws sts get-caller-identity
```

## Step 4: Create ECR Repositories

Run the setup script to create ECR repositories:

```bash
cd deploy-aws/ecs-fargate
chmod +x scripts/create-ecr-repos.sh
./scripts/create-ecr-repos.sh
```

## Step 5: Build and Push Docker Images

```bash
# Set your AWS account ID and region
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export AWS_REGION=us-west-2

# Login to ECR
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Build and push images
cd ../.. # Go to project root
chmod +x deploy-aws/ecs-fargate/scripts/build-and-push.sh
./deploy-aws/ecs-fargate/scripts/build-and-push.sh
```

## Step 6: Deploy Infrastructure with Terraform

```bash
cd deploy-aws/ecs-fargate/terraform

# Initialize Terraform
terraform init

# Review the plan
terraform plan

# Apply infrastructure (this will take 15-20 minutes)
terraform apply

# Save the outputs
terraform output > ../environments/terraform-outputs.txt
```

## Step 7: Deploy Application

```bash
# Deploy ECS services
cd ../scripts
chmod +x deploy-services.sh
./deploy-services.sh

# Monitor deployment
aws ecs list-services --cluster amex-review-cluster
aws ecs describe-services --cluster amex-review-cluster --services backend frontend celery
```

## Step 8: Verify Deployment

1. **Get the ALB URL**:
   ```bash
   aws elbv2 describe-load-balancers --names amex-review-alb --query 'LoadBalancers[0].DNSName' --output text
   ```

2. **Test the application**:
   - Frontend: http://[ALB-DNS-NAME]
   - Backend API: http://[ALB-DNS-NAME]/api/v1/docs
   - Flower: http://[ALB-DNS-NAME]:5555

3. **Check logs**:
   ```bash
   # View backend logs
   aws logs tail /ecs/amex-review/backend --follow

   # View frontend logs
   aws logs tail /ecs/amex-review/frontend --follow
   ```

## Step 9: Set Up CI/CD

The GitHub Actions workflow will automatically deploy on push to main:

1. **Add GitHub Secrets**:
   - Go to your GitHub repo → Settings → Secrets
   - Add these secrets:
     - `AWS_ACCESS_KEY_ID`
     - `AWS_SECRET_ACCESS_KEY`
     - `AWS_REGION`
     - `AWS_ACCOUNT_ID`

2. **Push to trigger deployment**:
   ```bash
   git add .
   git commit -m "Deploy to ECS Fargate"
   git push origin main
   ```

## Troubleshooting

### Common Issues:

1. **Task fails to start**:
   ```bash
   # Check task logs
   aws ecs describe-tasks --cluster amex-review-cluster --tasks [TASK-ARN]
   
   # Check CloudWatch logs
   aws logs get-log-events --log-group-name /ecs/amex-review/backend --log-stream-name [STREAM-NAME]
   ```

2. **Database connection issues**:
   ```bash
   # Verify security groups
   aws ec2 describe-security-groups --group-ids [SG-ID]
   
   # Test connection from ECS task
   aws ecs execute-command --cluster amex-review-cluster --task [TASK-ARN] --container backend --interactive --command "/bin/bash"
   ```

3. **Out of memory errors**:
   - Increase task CPU/memory in task definitions
   - Monitor CloudWatch metrics

### Useful Commands:

```bash
# Force new deployment
aws ecs update-service --cluster amex-review-cluster --service backend --force-new-deployment

# Scale service
aws ecs update-service --cluster amex-review-cluster --service backend --desired-count 3

# Stop all tasks
aws ecs list-tasks --cluster amex-review-cluster --service-name backend | jq -r '.taskArns[]' | xargs -I {} aws ecs stop-task --cluster amex-review-cluster --task {}
```

## Cost Optimization

1. **Use Fargate Spot for non-critical workloads**:
   - Celery workers can use Spot instances (70% cost savings)

2. **Set up auto-scaling**:
   - Scale down during off-hours
   - Use target tracking for CPU/memory

3. **Monitor costs**:
   ```bash
   # Enable Cost Explorer
   # Set up budget alerts in AWS Budgets
   ```

4. **Estimated monthly costs**:
   - ECS Fargate: ~$100-200 (depending on usage)
   - RDS PostgreSQL: ~$50-100
   - ElastiCache Redis: ~$25-50
   - ALB: ~$25
   - Data transfer: Variable
   - **Total: ~$200-400/month**

## Next Steps

1. **Set up custom domain**:
   - Register domain in Route 53
   - Create SSL certificate in ACM
   - Update ALB listeners

2. **Enable backups**:
   - RDS automated backups
   - EFS backup plan

3. **Implement monitoring**:
   - CloudWatch dashboards
   - SNS alerts
   - Application performance monitoring

4. **Security hardening**:
   - Enable AWS WAF
   - Implement least-privilege IAM roles
   - Enable VPC Flow Logs