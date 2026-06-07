FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
COPY tsconfig.base.json ./
COPY shared/package.json ./shared/
COPY shared/src ./shared/src/
COPY shared/tsconfig.json ./shared/
COPY frontend/package.json ./frontend/
COPY frontend/src ./frontend/src/
COPY frontend/index.html ./frontend/
COPY frontend/tsconfig.json ./frontend/
COPY frontend/vite.config.ts ./frontend/

RUN npm install --workspace=shared --workspace=frontend
RUN npm run build --workspace=shared
RUN npm run build --workspace=frontend

FROM nginx:alpine
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Railway передаёт PORT через переменную окружения
# nginx запускается через скрипт который подставляет порт
COPY frontend/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 8080
CMD ["/docker-entrypoint.sh"]
