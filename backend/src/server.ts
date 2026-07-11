import { app } from './app.js'
import { ensureDemoUser } from './data/store.js'

const port = Number(process.env.PORT ?? 4000)

ensureDemoUser().then(() => app.listen(port, () => {
  console.info(`SmartBus API listening on http://localhost:${port}`)
}))
