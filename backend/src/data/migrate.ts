import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/**
 * Applies checked-in Prisma migrations. Runs before the API starts accepting
 * traffic; a failed migration must fail startup rather than serve stale schema.
 */
export async function applyMigrations() {
  const { stdout, stderr } = await execFileAsync(
    process.platform === 'win32' ? 'node_modules\\.bin\\prisma.cmd' : 'node_modules/.bin/prisma',
    ['migrate', 'deploy'],
    { cwd: process.cwd(), env: process.env },
  )
  if (stdout.trim()) process.stdout.write(stdout)
  if (stderr.trim()) process.stderr.write(stderr)
}
