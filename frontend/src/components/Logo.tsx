import { Link } from 'react-router-dom'

export function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <Link className="brand" data-inverted={inverted || undefined} to="/" aria-label="VoyageBus home">
      <svg className="brand-logo" viewBox="0 0 44 44" role="img" aria-hidden="true">
        <path d="M8 33c7-1 9-8 14-8s7 7 14 6" />
        <path d="M10 25c4-1 6-4 8-9 2 5 5 8 9 8 4 0 6-2 8-5" />
        <path d="M8 35h28" />
      </svg>
      <span>Voyage<span>Bus</span></span>
    </Link>
  )
}
