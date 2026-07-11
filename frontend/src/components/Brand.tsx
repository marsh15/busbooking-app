import { Link } from 'react-router-dom'

export function Brand({ light = false }: { light?: boolean }) {
  return <Link className="brand" data-light={light || undefined} to="/" aria-label="VoyageBus home"><svg className="brand-mark" viewBox="0 0 36 36" aria-hidden="true"><path d="M8 25c5 0 6-7 10-7s5 7 10 7M9 12h18M12 8v8m12-8v8" /></svg><span>Voyage<strong>Bus</strong></span></Link>
}
