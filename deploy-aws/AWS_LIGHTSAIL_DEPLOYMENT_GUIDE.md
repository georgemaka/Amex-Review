# AWS Lightsail Deployment Guide for AMEX Coding Portal

## Overview
This guide will walk you through deploying the AMEX Coding Portal on AWS Lightsail as a subdomain of sukutapps.com. This approach is cost-effective (~$22/month), simple to manage, and perfect for your use case of 40 users accessing the system throughout the month.

## AWS Account Information
- **AWS Account ID**: 322325783793
- **IAM User**: portal-admin
- **Region**: us-east-1 (for consistency with existing infrastructure)
- **Parent Domain**: sukutapps.com
- **Target URL**: https://amex.sukutapps.com
- **Route 53 Hosted Zone ID**: Z0860330TU6D8FUIUUAJ
- **SSL Certificate**: Wildcard certificate already exists for *.sukutapps.com

## Prerequisites
- AWS CLI configured with portal-admin credentials
- GitHub repository with your code
- Basic familiarity with command line

## Why Lightsail?
- **Predictable Pricing**: $20/month for everything
- **Simplicity**: No complex AWS knowledge needed
- **All-Inclusive**: Compute, storage, static IP, and data transfer included
- **Built-in Features**: Firewall, snapshots, DNS management
- **Perfect Size**: 2GB RAM instance handles 40 users easily

---

## Step-by-Step Deployment Guide

### Step 1: Verify AWS Access and Open Lightsail
1. Verify your AWS CLI access:
   ```bash
   aws sts get-caller-identity
   # Should show: arn:aws:iam::322325783793:user/portal-admin
   ```
2. Go to [AWS Console](https://console.aws.amazon.com)
3. Sign in with your portal-admin credentials
4. **Important**: Switch to **us-east-1** region (top right corner)
5. In the search bar, type "Lightsail" and click on it
6. You'll see a simpler, more user-friendly interface than regular AWS

### Step 2: Create a Lightsail Instance

1. Click **"Create instance"**

2. **Select Location**:
   - **Use US East (N. Virginia) us-east-1** to match your existing infrastructure
   - This keeps everything in the same region for better performance

3. **Select Blueprint**:
   - Choose **"OS Only"**
   - Select **"Amazon Linux 2023"** (latest and most compatible)

4. **Add Launch Script** (Optional - we'll do this manually):
   - Skip for now

5. **Choose Instance Plan**:
   - Select **$20/month** plan (2GB RAM, 2 vCPUs, 60GB SSD)
   - This includes 3TB data transfer

6. **Name Your Instance**:
   - Name: `amex-coding-portal`

7. **Create Instance**
   - Click the button and wait 2-3 minutes for it to be ready

### Step 3: Set Up Static IP (Important!)

1. Go to **Networking** tab in Lightsail
2. Click **"Create static IP"**
3. Attach it to your `amex-coding-portal` instance
4. Name it: `amex-coding-portal-ip`
5. Note down this IP address (you'll need it)

### Step 4: Configure Firewall

1. Click on your instance
2. Go to **"Networking"** tab
3. Under **"IPv4 Firewall"**, you should see:
   - SSH (22) - Already there
   - HTTP (80) - Click "+ Add rule" if not there
   - HTTPS (443) - Click "+ Add rule" to add this

### Step 5: Connect to Your Instance

1. Click the **"Connect"** tab on your instance
2. Click **"Connect using SSH"** button
3. A terminal window opens in your browser

OR use your own terminal:
```bash
# Download the default key from Lightsail console
# Then connect:
ssh -i LightsailDefaultKey-us-east-1.pem ec2-user@YOUR_STATIC_IP
```

### Step 6: Install Required Software

Once connected, run these commands:

```bash
# Update system
sudo yum update -y

# Install Docker
sudo yum install docker -y
sudo service docker start
sudo systemctl enable docker
sudo usermod -a -G docker ec2-user

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Git
sudo yum install git -y

# Install Nginx (for reverse proxy)
sudo yum install nginx -y
sudo systemctl start nginx
sudo systemctl enable nginx

# Exit and reconnect for docker permissions
exit
```

Reconnect to your instance after the exit command.

### Step 7: Clone and Configure Your Application

```bash
# Create app directory
mkdir -p ~/apps
cd ~/apps

# Clone your repository
git clone https://github.com/YOUR_USERNAME/amex-coding-portal.git
cd amex-coding-portal

# Create production environment files
# Backend .env
cat > backend/.env.production << 'EOF'
DATABASE_URL=postgresql://postgres:your_secure_password@postgres:5432/amex_coding
REDIS_URL=redis://redis:6379/0
SECRET_KEY=your-very-long-random-secret-key-change-this
FRONTEND_URL=https://amex.sukutapps.com
CORS_ORIGINS=["https://amex.sukutapps.com"]
ENVIRONMENT=production
EOF

# Frontend .env
cat > frontend/.env.production << 'EOF'
REACT_APP_API_URL=https://amex.sukutapps.com
REACT_APP_ENVIRONMENT=production
EOF
```

### Step 8: Create Production Docker Compose File

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: amex_postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: your_secure_password
      POSTGRES_DB: amex_coding
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: always
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: amex_redis
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    restart: always
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: amex_backend
    env_file:
      - ./backend/.env.production
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./uploads:/app/uploads
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  celery:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: amex_celery
    command: celery -A app.core.celery worker --loglevel=info --concurrency=2
    env_file:
      - ./backend/.env.production
    depends_on:
      - redis
      - postgres
    volumes:
      - ./uploads:/app/uploads
    restart: always

  celery-beat:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: amex_celery_beat
    command: celery -A app.core.celery beat --loglevel=info
    env_file:
      - ./backend/.env.production
    depends_on:
      - redis
    restart: always

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        - REACT_APP_API_URL=https://amex.sukutapps.com
    container_name: amex_frontend
    restart: always

  nginx:
    image: nginx:alpine
    container_name: amex_nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.prod.conf:/etc/nginx/nginx.conf
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    depends_on:
      - backend
      - frontend
    restart: always

volumes:
  postgres_data:
```

### Step 9: Create Nginx Configuration

Create `nginx/nginx.prod.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml+rss;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

    server {
        listen 80;
        server_name amex.sukutapps.com;
        
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
        
        location / {
            return 301 https://$server_name$request_uri;
        }
    }

    server {
        listen 443 ssl;
        server_name amex.sukutapps.com;

        ssl_certificate /etc/letsencrypt/live/amex.sukutapps.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/amex.sukutapps.com/privkey.pem;

        # API endpoints
        location /api {
            proxy_pass http://backend:8000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Rate limiting for API
            limit_req zone=api burst=20 nodelay;
        }

        # Frontend
        location / {
            proxy_pass http://frontend:80;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

### Step 10: Set Up SSL Certificate

```bash
# Install certbot
sudo yum install certbot -y

# Create certbot directories
mkdir -p ~/apps/amex-coding-portal/certbot/conf
mkdir -p ~/apps/amex-coding-portal/certbot/www

# Get initial certificate
sudo certbot certonly --standalone -d amex.sukutapps.com --email your-email@domain.com --agree-tos --no-eff-email

# Copy certificates to your app directory
sudo cp -r /etc/letsencrypt/* ~/apps/amex-coding-portal/certbot/conf/

# Set up auto-renewal
echo "0 12 * * * /usr/bin/certbot renew --quiet" | sudo crontab -
```

### Step 11: Build and Run the Application

```bash
cd ~/apps/amex-coding-portal

# Build images
docker-compose -f docker-compose.prod.yml build

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Check if everything is running
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Run database migrations
docker-compose -f docker-compose.prod.yml exec backend alembic upgrade head

# Create admin user
docker-compose -f docker-compose.prod.yml exec backend python -m app.scripts.create_admin
```

### Step 12: Configure Route 53 for Your Domain

Since you already have Route 53 configured for sukutapps.com, we'll add the subdomain:

```bash
# Create Route 53 record configuration
cat > amex-route53-record.json << EOF
{
  "Changes": [
    {
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "amex.sukutapps.com",
        "Type": "A",
        "TTL": 300,
        "ResourceRecords": [
          {
            "Value": "YOUR_LIGHTSAIL_STATIC_IP"
          }
        ]
      }
    }
  ]
}
EOF

# Apply the DNS record
aws route53 change-resource-record-sets \
  --hosted-zone-id Z0860330TU6D8FUIUUAJ \
  --change-batch file://amex-route53-record.json

# Check the status
aws route53 get-change --id [CHANGE_ID_FROM_PREVIOUS_COMMAND]
```

**Note**: Replace `YOUR_LIGHTSAIL_STATIC_IP` with the actual static IP from Step 3.

### Step 13: Set Up Automated Backups

1. **Lightsail Snapshots** (Easiest):
   - In Lightsail console, click your instance
   - Go to **"Snapshots"** tab
   - Enable automatic snapshots
   - Cost: $2/month for 7 daily snapshots

2. **Database Backup Script**:
```bash
# Create backup script
cat > ~/backup-database.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/ec2-user/backups"
mkdir -p $BACKUP_DIR

# Backup PostgreSQL
docker exec amex_postgres pg_dump -U postgres amex_coding | gzip > $BACKUP_DIR/amex_db_$DATE.sql.gz

# Keep only last 7 days
find $BACKUP_DIR -name "amex_db_*.sql.gz" -mtime +7 -delete

# Optional: Copy to S3 if you have a bucket
# aws s3 cp $BACKUP_DIR/amex_db_$DATE.sql.gz s3://your-backup-bucket/
EOF

chmod +x ~/backup-database.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /home/ec2-user/backup-database.sh") | crontab -
```

### Step 14: Monitoring

Create a simple monitoring script:

```bash
cat > ~/monitor.sh << 'EOF'
#!/bin/bash
# Check if services are running
if ! docker-compose -f ~/apps/amex-coding-portal/docker-compose.prod.yml ps | grep -q "Up"; then
    echo "Services are down! Restarting..."
    cd ~/apps/amex-coding-portal
    docker-compose -f docker-compose.prod.yml restart
fi
EOF

chmod +x ~/monitor.sh

# Add to crontab (every 5 minutes)
(crontab -l 2>/dev/null; echo "*/5 * * * * /home/ec2-user/monitor.sh") | crontab -
```

### Step 15: Updates and Maintenance

Create an update script:

```bash
cat > ~/apps/amex-coding-portal/update.sh << 'EOF'
#!/bin/bash
cd ~/apps/amex-coding-portal

# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d

# Run migrations
docker-compose -f docker-compose.prod.yml exec backend alembic upgrade head

echo "Update complete!"
EOF

chmod +x ~/apps/amex-coding-portal/update.sh
```

---

## Common Tasks

### View Logs
```bash
# All logs
docker-compose -f docker-compose.prod.yml logs

# Specific service
docker-compose -f docker-compose.prod.yml logs backend

# Follow logs
docker-compose -f docker-compose.prod.yml logs -f backend
```

### Restart Services
```bash
# Restart all
docker-compose -f docker-compose.prod.yml restart

# Restart specific service
docker-compose -f docker-compose.prod.yml restart backend
```

### Database Access
```bash
# Access PostgreSQL
docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres -d amex_coding

# Backup database
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U postgres amex_coding > backup.sql
```

### Update Application
```bash
cd ~/apps/amex-coding-portal
./update.sh
```

---

## Troubleshooting

### Service Won't Start
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs [service_name]

# Check disk space
df -h

# Check memory
free -m
```

### Database Connection Issues
```bash
# Test database connection
docker-compose -f docker-compose.prod.yml exec backend python -c "from app.db.session import SessionLocal; db = SessionLocal(); print('Connected!')"
```

### SSL Certificate Issues
```bash
# Renew certificate manually
sudo certbot renew

# Copy to app directory
sudo cp -r /etc/letsencrypt/* ~/apps/amex-coding-portal/certbot/conf/
```

---

## Monthly Costs

- **Lightsail Instance**: $20/month
- **Automated Snapshots**: $2/month
- **Total**: $22/month

This includes:
- 2 vCPUs, 2GB RAM, 60GB SSD
- 3TB data transfer
- Static IP
- Firewall
- DNS management (if using Lightsail DNS)

---

## Security Checklist

- [ ] Change default PostgreSQL password
- [ ] Generate new SECRET_KEY for backend
- [ ] Enable Lightsail firewall (only allow 22, 80, 443)
- [ ] Set up SSL certificate
- [ ] Enable automated backups
- [ ] Keep system updated (`sudo yum update -y` monthly)
- [ ] Monitor logs for suspicious activity
- [ ] Use strong passwords for admin accounts

---

## Next Steps

1. **Test Everything**: Access your site at `https://amex.sukutapps.com`
2. **Create Admin User**: Use the admin creation script
3. **Upload Test Data**: Try uploading a statement
4. **Monitor for a Week**: Check logs and performance
5. **Document Any Issues**: Keep notes for future reference

---

## Portal Integration

The main portal at sukutapps.com is already configured to show the AMEX app with:
- **Name**: American Express Expenses
- **Icon**: 💳
- **Color**: Purple (bg-purple-500)
- **URL**: https://amex.sukutapps.com
- **Access**: Admin and Manager roles

Once deployed, users can access the app by:
1. Going to https://sukutapps.com
2. Logging into the portal
3. Clicking the "American Express Expenses" tile

---

## Alternative: S3 Frontend + Lightsail Backend

If you want to reduce costs further and leverage existing infrastructure, you could:
1. Deploy the React frontend to S3/CloudFront (like the existing portal setup)
2. Deploy only the backend services (FastAPI, PostgreSQL, Celery) to Lightsail
3. This would require updating the nginx configuration to handle CORS properly

This hybrid approach would:
- Use existing CloudFront distribution
- Reduce Lightsail resource usage
- Cost: ~$15-18/month

---

## Support Resources

- **AWS Lightsail Documentation**: https://lightsail.aws.amazon.com/ls/docs/
- **Docker Documentation**: https://docs.docker.com/
- **PostgreSQL Documentation**: https://www.postgresql.org/docs/
- **Route 53 Documentation**: https://docs.aws.amazon.com/Route53/
- **Your Application Logs**: Most issues can be diagnosed from logs

Remember: Start with the default settings. You can always scale up the Lightsail instance if needed (takes just a few minutes).