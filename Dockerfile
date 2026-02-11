# Stage 1: Build
FROM node:20-alpine AS builder

# Install openssl for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies (including devDependencies for build)
RUN npm install --include=dev

# Copy source code
COPY . .

# Generate Prisma Client (openssl must be present here)
RUN npx prisma generate

# Build the application
RUN npx nest build

# Stage 2: Production
FROM node:20-alpine

# Install curl for Coolify, openssl for Prisma, and Python/OpenCV for Magic Scan
RUN apk add --no-cache \
    curl \
    openssl \
    libc6-compat \
    python3 \
    py3-pip \
    py3-opencv \
    py3-numpy \
    mesa-gl \
    libstdc++

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install only production dependencies
RUN npm install --omit=dev

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Create uploads directory
RUN mkdir -p uploads

# Expose the API port
EXPOSE 4000

# Start the application - Entry point is dist/src/main.js
CMD ["node", "dist/src/main.js"]
