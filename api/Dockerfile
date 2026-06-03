# syntax=docker/dockerfile:1.6

# ---------- Build stage ----------
FROM node:20-slim AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --include=dev

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# ---------- Runtime stage ----------
FROM node:20-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

# Create non-root user
RUN groupadd --system app && useradd --system --gid app --home /app --shell /bin/false app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

USER app

EXPOSE 3001
CMD ["node", "dist/server.js"]
