FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --production
COPY backend/ ./
COPY --from=frontend-builder /app/dist ./public
ENV PUBLIC_DIR=/app/public
ENV PORT=80
EXPOSE 80
CMD ["npx", "tsx", "src/index.ts"]
