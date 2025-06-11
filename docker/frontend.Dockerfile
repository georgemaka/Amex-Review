FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with legacy peer deps to handle conflicts
RUN npm install --legacy-peer-deps

# Copy application code
COPY . .

# Build for production
RUN npm run build

# Expose port
EXPOSE 3000

# For development
CMD ["npm", "run", "dev"]