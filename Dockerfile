# Runtime Garden Social Studio — local dev + production-capable image
# Node 22 required (node:sqlite). Reproducible, no secrets committed.
FROM node:22-alpine AS deps-prod
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY packages ./packages
COPY apps ./apps
RUN npm run build:core && npm run build:web

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S rgstudio && adduser -S rgstudio -G rgstudio \
    && mkdir -p /app/data && chown -R rgstudio:rgstudio /app
COPY --from=deps-prod /app/node_modules ./node_modules
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY --from=build /app/packages/studio-core/dist ./packages/studio-core/dist
COPY package.json package-lock.json ./
COPY apps ./apps
COPY packages ./packages
COPY migrations ./migrations
COPY tools ./tools
COPY assets ./assets
USER rgstudio
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.RG_PORT||8787)+'/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/dist/web.js"]
