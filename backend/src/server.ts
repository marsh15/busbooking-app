import { app } from './app.js'
import { connectDatabase, disconnectDatabase } from './data/prisma.js'
import { seedDemoData } from './data/seed.js'
import { validateEnvironment } from './config/env.js'
import { logger } from './config/logger.js'

async function start() {
  const environment = validateEnvironment()
  await connectDatabase()
  await seedDemoData()
  const server = app.listen(environment.PORT, '0.0.0.0', () => logger.info('server_started', { port: environment.PORT }))
  const shutdown = () => server.close(() => void disconnectDatabase().finally(() => process.exit(0)))
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
}

start().catch((error) => {
  logger.error('server_start_failed', { error: error instanceof Error ? error.message : String(error) })
  void disconnectDatabase().finally(() => process.exit(1))
})
