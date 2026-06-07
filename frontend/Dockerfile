FROM node:20-alpine AS builder

WORKDIR /app

COPY shared/package.json ./shared/
COPY shared/src ./shared/src/

COPY frontend/package.json ./frontend/
COPY frontend/src ./frontend/src/
COPY frontend/index.html ./frontend/
COPY frontend/tsconfig.json ./frontend/
COPY frontend/vite.config.ts ./frontend/
COPY package.json ./

RUN npm install --workspace=shared --workspace=frontend
RUN npm run build --workspace=shared
RUN npm run build --workspace=frontend

FROM nginx:alpine
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
