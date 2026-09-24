import { prisma } from './prisma.js'
import { logger } from '../config/logger.js'

const CLEANUP_BATCH = 25
let lastRun = 0
const THROTTLE_MS = 10 * 60_000

/**
 * Removes demo-only data for accounts past their 24-hour expiry, in bounded
 * batches. Still-active booked seats are released back to inventory first.
 * Runs at startup and opportunistically when new demo sessions are created.
 */
export async function cleanupExpiredDemoData(batch = CLEANUP_BATCH) {
  const expired = await prisma.user.findMany({
    where: { isDemo: true, demoExpiresAt: { lte: new Date() } },
    select: { id: true },
    take: batch,
    orderBy: { demoExpiresAt: 'asc' },
  })
  for (const user of expired) {
    await prisma.$transaction(async (tx) => {
      const activeTickets = await tx.booking.findMany({
        where: { userId: user.id, status: 'ACTIVE' },
        select: { seatId: true },
      })
      if (activeTickets.length) {
        await tx.seat.updateMany({
          where: { id: { in: activeTickets.map((ticket) => ticket.seatId) }, status: 'BOOKED' },
          data: { status: 'AVAILABLE', holdId: null, holdExpiresAt: null },
        })
        await tx.booking.updateMany({
          where: { userId: user.id, status: 'ACTIVE' },
          data: { status: 'CANCELLED', cancelledAt: new Date(), refundAmount: 0 },
        })
      }
      const activeHolds = await tx.seatHold.findMany({
        where: { userId: user.id, status: 'ACTIVE' },
        select: { id: true },
      })
      for (const hold of activeHolds) {
        await tx.seat.updateMany({
          where: { holdId: hold.id, status: 'HELD' },
          data: { status: 'AVAILABLE', holdId: null, holdExpiresAt: null },
        })
        await tx.seatHold.update({ where: { id: hold.id }, data: { status: 'RELEASED' } })
      }
      await tx.booking.deleteMany({ where: { userId: user.id } })
      await tx.bookingGroup.deleteMany({ where: { userId: user.id } })
      await tx.paymentAttempt.deleteMany({ where: { userId: user.id } })
      await tx.seatHold.deleteMany({ where: { userId: user.id } })
      await tx.user.delete({ where: { id: user.id } })
    })
  }
  if (expired.length) logger.info('demo_cleanup', { removedAccounts: expired.length })
  return expired.length
}

/** Fire-and-forget variant throttled so request paths never spawn hot loops. */
export function scheduleDemoCleanup() {
  if (Date.now() - lastRun < THROTTLE_MS) return
  lastRun = Date.now()
  void cleanupExpiredDemoData().catch((error) =>
    logger.error('demo_cleanup_failed', {
      error: error instanceof Error ? error.message : String(error),
    }),
  )
}
