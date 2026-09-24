import type { Seat } from '../types'

function seatTone(seat: Seat, isSelected: boolean) {
  if (seat.status === 'BOOKED') return 'booked'
  if (seat.status === 'HELD' && !seat.heldByYou) return 'held'
  return isSelected ? 'selected' : 'available'
}

function seatLabel(seat: Seat, isSelected: boolean) {
  if (seat.status === 'BOOKED') return `Seat ${seat.number}, booked`
  if (seat.status === 'HELD' && !seat.heldByYou) return `Seat ${seat.number}, held by another traveller`
  if (isSelected) return `Seat ${seat.number}, selected`
  return `Seat ${seat.number}, available`
}

export function SeatMap({
  seats,
  selected,
  onChange,
}: {
  seats: Seat[]
  selected: string[]
  onChange: (seats: string[]) => void
}) {
  function toggle(seat: Seat) {
    if (seat.status === 'BOOKED') return
    if (seat.status === 'HELD' && !seat.heldByYou) return
    if (selected.includes(seat.number)) return onChange(selected.filter((number) => number !== seat.number))
    if (selected.length < 6) onChange([...selected, seat.number])
  }
  return (
    <section className="seat-section" aria-labelledby="seat-map-title">
      <div className="seat-heading">
        <div>
          <p className="eyebrow">Choose up to 6</p>
          <h2 id="seat-map-title">Pick your seats</h2>
        </div>
        <span className="selection-count" aria-live="polite">
          {selected.length} selected
        </span>
      </div>
      <div className="seat-legend" aria-label="Seat map legend">
        <span>
          <i className="seat available" />
          Available
        </span>
        <span>
          <i className="seat selected" />
          Selected
        </span>
        <span>
          <i className="seat held" />
          Held by another traveller
        </span>
        <span>
          <i className="seat booked" />
          Booked
        </span>
      </div>
      <div className="bus-shell">
        <div className="driver">Driver</div>
        <div className="seat-grid" role="group" aria-label="Bus seat map">
          {seats.map((seat) => {
            const isSelected = selected.includes(seat.number)
            const tone = seatTone(seat, isSelected)
            return (
              <button
                key={seat.id}
                className={`seat column-${seat.column} ${tone}`}
                onClick={() => toggle(seat)}
                disabled={seat.status === 'BOOKED' || (seat.status === 'HELD' && !seat.heldByYou)}
                aria-pressed={isSelected}
                aria-label={seatLabel(seat, isSelected)}
              >
                {seat.number}
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
