# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies first (layer-cached until package.json changes)
COPY package.json ./
RUN npm install --frozen-lockfile

# Copy source and compile TypeScript
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ── Production stage ──────────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Install only production dependencies
COPY package.json ./
RUN npm install --frozen-lockfile --omit=dev

# Copy compiled output from build stage
COPY --from=build /app/dist ./dist

# Reports directory — bind-mounted or ephemeral volume
RUN mkdir -p /app/reports

EXPOSE 3000

HEALTHCHECK --interval=5s --timeout=5s --retries=12 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
