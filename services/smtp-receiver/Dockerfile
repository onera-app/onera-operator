FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY src/ ./src/

# SMTP on port 25, health check on port 8080
EXPOSE 25 8080

# Port 25 requires root — ACI runs in an isolated container so this is safe
CMD ["node", "src/index.js"]
