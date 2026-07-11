import { Link } from 'react-router-dom'

export function Brand({ light = false }: { light?: boolean }) {
  return <Link className="brand" data-light={light || undefined} to="/" aria-label="SmartBus Lite home"><span className="brand-mark">S</span><span>SmartBus <em>Lite</em></span></Link>
}
