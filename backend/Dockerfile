FROM node:22-bookworm-slim AS dependencies

WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build

COPY tsconfig.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm run db:generate
COPY src ./src
RUN npm run typecheck

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src ./src
COPY tsconfig.json prisma.config.ts ./

EXPOSE 8080
CMD ["npm", "start"]
