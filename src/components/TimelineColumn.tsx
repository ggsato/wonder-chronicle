import type { Granularity, TimelineColumnViewModel } from '../types'

type TimelineColumnProps = {
  column: TimelineColumnViewModel
  granularity: Granularity
  isFocused: boolean
  onClick: () => void
}

export function TimelineColumn({
  column,
  granularity,
  isFocused,
  onClick,
}: TimelineColumnProps) {
  return (
    <button
      className={`timeline-column timeline-column--${granularity} ${
        isFocused ? 'timeline-column--focused' : ''
      }`}
      data-period-id={column.periodId}
      onClick={onClick}
      type="button"
    >
      <span className="timeline-column__rule" aria-hidden="true" />

      <div className="timeline-column__meta">
        <span className="timeline-column__label">{column.periodLabel}</span>
        {column.summaryTitle ? (
          <span className="timeline-column__summary">{column.summaryTitle}</span>
        ) : null}
      </div>

      <div className="timeline-column__body">
        <div className="timeline-column__media">
          {column.photo ? (
            <figure className="timeline-column__photoWrap">
              <img
                className="timeline-column__photo"
                src={column.photo.url}
                alt={column.photo.alt}
              />
            </figure>
          ) : (
            <span className="timeline-column__placeholder">写真なし</span>
          )}
        </div>

        <div className="timeline-column__content">
          <div className="timeline-column__section">
            <span className="timeline-column__tag" aria-label="願い">
              <span>願</span>
              <span>い</span>
            </span>
            <div className="timeline-column__copy">
              <p>{column.wishText}</p>
            </div>
          </div>

          <div className="timeline-column__section">
            <span className="timeline-column__tag" aria-label="感動">
              <span>感</span>
              <span>動</span>
            </span>
            <div className="timeline-column__copy">
              <p>{column.wonderAtText}</p>
            </div>
          </div>

          <div className="timeline-column__section">
            <span className="timeline-column__tag" aria-label="問い">
              <span>問</span>
              <span>い</span>
            </span>
            <div className="timeline-column__copy">
              <p>{column.wonderAboutText}</p>
            </div>
          </div>
        </div>
      </div>
    </button>
  )
}
