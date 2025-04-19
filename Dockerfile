FROM node:22.12-alpine AS builder

# Copy source code and configs
COPY src /app/src
COPY package*.json /app/
COPY tsconfig.json /app/

WORKDIR /app

# Install dependencies and build
RUN --mount=type=cache,target=/root/.npm npm install
RUN npm run build

FROM node:22-alpine AS release

WORKDIR /app

# Copy only necessary files from builder
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/package-lock.json /app/package-lock.json

ENV NODE_ENV=production

# Install production dependencies only
RUN npm ci --ignore-scripts --omit-dev

ENTRYPOINT ["node", "dist/index.js"]
