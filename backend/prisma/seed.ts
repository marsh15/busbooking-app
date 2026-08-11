import { disconnectDatabase } from '../src/data/prisma.js'
import { seedDemoData } from '../src/data/seed.js'

seedDemoData()
  .then(() => console.info('VoyageBus demo data is ready.'))
  .finally(disconnectDatabase)
