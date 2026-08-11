import { Link } from 'react-router-dom'

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link className="brand" data-light={light || undefined} to="/" aria-label="VoyageBus home">
      <span className="brand-mark">V</span>
      <span>
        Voyage<em>Bus</em>
      </span>
    </Link>
  )
}
