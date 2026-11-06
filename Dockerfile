# Single-service image: Express serves both the built React app and the API.
FROM node:20-alpine

WORKDIR /app

# Install dependencies for root, client and server first (better layer caching).
COPY package*.json ./
COPY client/package*.json client/
COPY server/package*.json server/
RUN npm install && npm --prefix client install && npm --prefix server install

# Copy sources and build the React app into client/dist.
COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000

# MongoDB URI / JWT secret are provided at runtime (never baked into the image).
CMD ["npm", "start"]
