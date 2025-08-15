# Multi-stage build for standalone app (UI + API)
# Stage 1: build React client
FROM node:20-alpine AS client-builder
WORKDIR /app
# Install client deps
COPY react-client/package*.json ./react-client/
RUN npm ci --prefix react-client
# Build client
COPY react-client ./react-client
RUN npm run build --prefix react-client

# Stage 2: install server deps
FROM node:20-alpine AS server-deps
WORKDIR /app
COPY server/package*.json ./server/
# Only production deps for server; vite is only needed in dev
RUN npm ci --omit=dev --prefix server
COPY server ./server

# Stage 3: runtime image
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Copy server and built client
COPY --from=server-deps /app/server /app/server
COPY --from=client-builder /app/react-client/dist /app/react-client/dist
# Ensure data directory exists and persists via volume if desired
RUN mkdir -p /app/server/data
VOLUME ["/app/server/data"]
EXPOSE 4000
CMD ["node", "server/index.js"]
