FROM node:20-alpine

# Installation de FFmpeg natif
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Copie des dépendances
COPY package*.json ./
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

# Copie du code source
COPY . .

# Construction du projet Next.js
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start"]
