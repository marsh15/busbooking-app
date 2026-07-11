FROM node:22-bookworm-slim AS dependencies

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build

# Prisma loads prisma.config.ts while generating the client and requires the
# variable to exist, but it does not connect to the database during generation.
ENV DATABASE_URL=mysql://build:build@localhost:3306/build

COPY tsconfig.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm run db:generate
COPY src ./src
RUN npm run typecheck

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src ./src
COPY tsconfig.json prisma.config.ts ./

EXPOSE 8080
CMD ["npm", "start"]
