FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package.json (workspaces)
COPY package.json ./
COPY tsconfig.base.json ./

# Copy shared
COPY shared/package.json ./shared/
COPY shared/src ./shared/src/
COPY shared/tsconfig.json ./shared/

# Copy backend
COPY backend/package.json ./backend/
COPY backend/src ./backend/src/
COPY backend/tsconfig.json ./backend/
COPY backend/knexfile.ts ./backend/

RUN npm install --workspace=shared --workspace=backend
RUN npm run build --workspace=shared
RUN npm run build --workspace=backend

FROM node:20-alpine
WORKDIR /app

COPY package.json ./
COPY --from=builder /app/shared/dist ./shared/dist/
COPY --from=builder /app/shared/package.json ./shared/
COPY --from=builder /app/backend/dist ./backend/dist/
COPY --from=builder /app/backend/package.json ./backend/

RUN npm install --workspace=shared --workspace=backend --omit=dev

WORKDIR /app/backend
EXPOSE 3001
CMD ["node", "dist/index.js"]
