// The running MVP uses an in-memory demo store so it can launch without Docker.
// This seed contract mirrors the deterministic data in src/data/store.ts; replace it
// with Prisma upserts when connecting a MySQL/TiDB database for deployment.
import { db } from '../src/data/store.js'
console.log(`Prepared ${db.trips.length} seeded trips across ${new Set(db.trips.map((trip) => trip.travelDate)).size} IST dates.`)
