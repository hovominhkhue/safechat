FROM node:20-alpine

WORKDIR /app

# 1. Copier seulement package*.json pour profiter du cache Docker
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm install --omit=dev

# 2. Copier le code du backend
COPY backend/ ./

# 3. Copier le frontend (servi en static par Express)
COPY frontend/ /app/frontend/

# 4. Variables d'environnement par défaut (override via docker-compose)
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "src/server.js"]
