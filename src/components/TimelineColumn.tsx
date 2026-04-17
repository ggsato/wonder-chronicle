import type { TimelineColumnViewModel } from '../types'

type TimelineColumnProps = {
  column: TimelineColumnViewModel
  isFocused: boolean
  onClick: () => void
}

export function TimelineColumn({
  column,
  isFocused,
  onClick,
}: TimelineColumnProps) {
  const granularity = column.granularity

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
        {column.kind !== 'change-point' && column.summaryTitle ? (
          <span className="timeline-column__summary">{column.summaryTitle}</span>
        ) : null}
      </div>

      <div className="timeline-column__body">
        {column.kind === 'change-point' ? (
          <div className="timeline-column__content timeline-column__content--change-point">
            <div className="timeline-column__section timeline-column__section--change-point">
              <span className="timeline-column__tag" aria-label="変化点">
                <span>変</span>
                <span>化</span>
              </span>
              <div className="timeline-column__copy timeline-column__copy--change-point">
                <p>{column.summaryTitle}</p>
              </div>
            </div>
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>
    </button>
  )
}
