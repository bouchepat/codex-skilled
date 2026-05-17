FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install
EXPOSE 4200

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.d/40-write-config.sh /docker-entrypoint.d/40-write-config.sh
COPY --from=builder /app/dist/codex-skilled/browser /usr/share/nginx/html
RUN chmod +x /docker-entrypoint.d/40-write-config.sh
EXPOSE 80
