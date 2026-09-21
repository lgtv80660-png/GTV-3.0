FROM node:20-alpine

# Installation de FFmpeg et des dependances systeme
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Copie des fichiers de dependances
COPY package*.json ./

# Installation des packages Node
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

# Copie du reste du code source
COPY . .

# Construction de l application Next.js
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
