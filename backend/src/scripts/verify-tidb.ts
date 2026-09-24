import { prisma, disconnectDatabase } from '../data/prisma.js'

/**
 * Pre-release gate: fails fast when DATABASE_URL does not point at TiDB, so
 * `npm run test:tidb` cannot silently pass against local MySQL.
 */
async function main() {
  const rows = await prisma.$queryRaw<Array<{ version: string }>>`SELECT version() AS version`
  const version = rows[0]?.version ?? ''
  if (!version.toLowerCase().includes('tidb')) {
    console.error(
      `Not a TiDB connection (server reported "${version}"). Point DATABASE_URL at the TiDB Cloud Starter cluster.`,
    )
    process.exitCode = 1
    return
  }
  console.log(`TiDB confirmed: ${version}`)
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
  .finally(() => void disconnectDatabase())
