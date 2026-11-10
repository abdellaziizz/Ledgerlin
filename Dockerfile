# Ledgerline API
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM node:24-alpine
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json openapi.yaml *.js ./
COPY controllers ./controllers
COPY middleware ./middleware
COPY migration ./migration
COPY routes ./routes
COPY schemas ./schemas
COPY scripts ./scripts
COPY services ./services
COPY utils ./utils
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
