FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package.json (workspaces)
COPY package.json ./

# Copy shared
COPY shared/package.json ./shared/
COPY shared/src ./shared/src/
COPY shared/tsconfig.json ./shared/

# Copy frontend
COPY frontend/package.json ./frontend/
COPY frontend/src ./frontend/src/
COPY frontend/index.html ./frontend/
COPY frontend/tsconfig.json ./frontend/
COPY frontend/vite.config.ts ./frontend/
COPY tsconfig.base.json ./

RUN npm install --workspace=shared --workspace=frontend
RUN npm run build --workspace=shared
RUN npm run build --workspace=frontend

FROM nginx:alpine
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
# nginx.conf копируем из контекста сборки (корень репо)
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
