FROM node:20-alpine

WORKDIR /app

# Copy shared package
COPY shared/package.json ./shared/
COPY shared/src ./shared/src/

# Copy backend
COPY backend/package.json ./backend/
COPY backend/src ./backend/src/
COPY backend/tsconfig.json ./backend/
COPY package.json ./

# Install dependencies
RUN npm install --workspace=shared --workspace=backend

# Build shared then backend
RUN npm run build --workspace=shared
RUN npm run build --workspace=backend

WORKDIR /app/backend

EXPOSE 3001

CMD ["node", "dist/index.js"]
