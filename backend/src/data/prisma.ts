import 'dotenv/config'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaClient } from '@prisma/client'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required. SmartBus does not use an in-memory fallback.')
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }
const databaseUrl = new URL(process.env.DATABASE_URL)

// TiDB Cloud requires TLS. `sslaccept=strict` is used by Prisma CLI commands,
// while the MariaDB driver adapter needs its TLS option configured directly.
const adapter = new PrismaMariaDb({
  host: databaseUrl.hostname,
  port: Number(databaseUrl.port || 3306),
  user: decodeURIComponent(databaseUrl.username),
  password: decodeURIComponent(databaseUrl.password),
  database: decodeURIComponent(databaseUrl.pathname.slice(1)),
  ssl: true,
})

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export async function connectDatabase() {
  await prisma.$connect()
}

export async function disconnectDatabase() {
  await prisma.$disconnect()
}
