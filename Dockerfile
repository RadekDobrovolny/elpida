FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run prisma:generate
RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "npm run db:push && node .output/server/index.mjs"]
