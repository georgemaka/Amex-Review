# AMEX Review Portal - AWS Deployment Instructions

## Quick Start

1. **Prerequisites**
   - AWS CLI installed and configured
   - Docker installed and running
   - Git repository cloned
   - AWS account with appropriate permissions

2. **Deploy Everything**
   ```bash
   cd /path/to/amex-review
   ./deploy-aws/deploy-all.sh
   # Select option 1 for full deployment
   ```

3. **Access Your Application**
   - URL: https://amex.sukutapps.com
   - Admin: admin@sukut.com / password123

## Step-by-Step Deployment

### 1. Configure AWS CLI
```bash
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Default region: us-east-1
# Default output format: json
```

### 2. Run Infrastructure Setup
```bash
./deploy-aws/scripts/01-setup-infrastructure.sh  # VPC, subnets, security groups
./deploy-aws/scripts/02-setup-databases.sh       # RDS PostgreSQL, ElastiCache Redis
./deploy-aws/scripts/03-setup-storage.sh         # EFS for files, optional S3
./deploy-aws/scripts/04-setup-ecs.sh            # ECS cluster, ALB, ECR repos
```

### 3. Build and Deploy Application
```bash
./deploy-aws/scripts/05-build-and-push.sh       # Build Docker images
./deploy-aws/scripts/06-deploy-services.sh      # Deploy ECS services
./deploy-aws/scripts/07-configure-dns.sh        # SSL certificate and Route 53
```

## Configuration Files

All deployment scripts create configuration in `deploy-aws/config/infrastructure.env`

### Required Secrets in AWS Secrets Manager
- `amex-review/database-url` - PostgreSQL connection string
- `amex-review/redis-url` - Redis connection string
- `amex-review/secret-key` - Application secret key
- `amex-review/smtp-user` - SMTP username (optional)
- `amex-review/smtp-password` - SMTP password (optional)

## GitHub Actions Setup

1. Add secrets to your GitHub repository:
   ```
   AWS_ACCESS_KEY_ID
   AWS_SECRET_ACCESS_KEY
   ```

2. Push to main branch to trigger deployment:
   ```bash
   git push origin main
   ```

## Monitoring and Logs

### View Logs
```bash
# Backend logs
aws logs tail /ecs/amex-review/backend --follow

# Frontend logs
aws logs tail /ecs/amex-review/frontend --follow

# Celery worker logs
aws logs tail /ecs/amex-review/celery --follow
```

### ECS Console
https://console.aws.amazon.com/ecs/home?region=us-east-1#/clusters/amex-review-cluster

### CloudWatch Dashboard
The deployment creates a basic CloudWatch dashboard for monitoring.

## Updating the Application

### Quick Update (via GitHub Actions)
```bash
git add .
git commit -m "Update application"
git push origin main
# GitHub Actions will automatically deploy
```

### Manual Update
```bash
./deploy-aws/deploy-all.sh
# Select option 4 for update
```

### Update Specific Service
```bash
# Update only backend
aws ecs update-service --cluster amex-review-cluster --service backend --force-new-deployment

# Update only frontend
aws ecs update-service --cluster amex-review-cluster --service frontend --force-new-deployment
```

## Troubleshooting

### Service Won't Start
1. Check logs: `aws logs tail /ecs/amex-review/SERVICE_NAME`
2. Check task stopped reason:
   ```bash
   aws ecs describe-tasks --cluster amex-review-cluster \
     --tasks $(aws ecs list-tasks --cluster amex-review-cluster --service-name backend --query 'taskArns[0]' --output text)
   ```

### Database Connection Issues
1. Verify security groups allow connection
2. Check secrets in Secrets Manager
3. Test from ECS task:
   ```bash
   aws ecs execute-command --cluster amex-review-cluster \
     --task TASK_ARN --container backend --interactive \
     --command "/bin/bash"
   ```

### Domain Not Working
1. Check Route 53 record
2. Verify SSL certificate is validated
3. Test with: `nslookup amex.sukutapps.com`

## Cost Management

### Estimated Monthly Costs
- ECS Fargate: ~$40-60
- RDS PostgreSQL: ~$25
- ElastiCache Redis: ~$15
- ALB: ~$20
- EFS: ~$5
- **Total: ~$100-150/month**

### Cost Optimization
1. Use Fargate Spot for Celery workers
2. Schedule scale-down during off-hours
3. Consider Reserved Instances for RDS
4. Monitor with AWS Cost Explorer

## Security Best Practices

1. **Secrets**: All sensitive data in AWS Secrets Manager
2. **Network**: Private subnets for all services
3. **Encryption**: SSL/TLS for all connections
4. **Access**: IAM roles with least privilege
5. **Updates**: Regular security patches

## Backup and Recovery

### Automated Backups
- RDS: 7-day retention (configured)
- EFS: Use AWS Backup (optional)

### Manual Backup
```bash
# Database backup
pg_dump -h RDS_ENDPOINT -U postgres amex_coding > backup.sql

# EFS backup
aws efs create-backup --file-system-id fs-xxxxxx
```

## Scaling

### Auto-scaling (configured)
- Backend: 1-10 tasks based on CPU
- Frontend: 1-5 tasks based on CPU

### Manual Scaling
```bash
# Scale backend
aws ecs update-service --cluster amex-review-cluster \
  --service backend --desired-count 3

# Scale frontend
aws ecs update-service --cluster amex-review-cluster \
  --service frontend --desired-count 3
```

## Support

- AWS Support: Through your AWS account
- Application Issues: Create GitHub issue
- Email: gl@sukut.com