import { app } from './app.js'
import { connectDatabase, disconnectDatabase } from './data/prisma.js'
import { seedDemoData } from './data/seed.js'

const port = Number(process.env.PORT ?? 4000)

async function start() {
  await connectDatabase()
  await seedDemoData()
  const server = app.listen(port, () => console.info(`SmartBus API listening on http://localhost:${port}`))
  const shutdown = () => server.close(() => void disconnectDatabase().finally(() => process.exit(0)))
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
}

start().catch((error) => {
  console.error('SmartBus API failed to start:', error)
  void disconnectDatabase().finally(() => process.exit(1))
})
