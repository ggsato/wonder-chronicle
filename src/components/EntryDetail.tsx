import type { AggregatedPeriod, JournalEntry } from '../types'

type EntryDetailProps = {
  period: AggregatedPeriod
  entries: JournalEntry[]
  onBack: () => void
  onGoPrev: () => void
  onGoNext: () => void
  onEditEntry: (entry: JournalEntry) => void
  variant?: 'panel' | 'sheet'
}

export function EntryDetail({
  period,
  entries,
  onBack,
  onGoPrev,
  onGoNext,
  onEditEntry,
  variant = 'panel',
}: EntryDetailProps) {
  return (
    <aside className={`detail-panel ${variant === 'sheet' ? 'detail-panel--sheet' : ''}`}>
      <div className="detail-panel__header">
        <div>
          <p className="panel__eyebrow">Entry Detail</p>
          <h2>{period.periodLabel}</h2>
          {period.summaryTitle ? <p className="detail-panel__summary">{period.summaryTitle}</p> : null}
        </div>
        <button className="panel__close" onClick={onBack} type="button">
          閉じる
        </button>
      </div>

      {period.representativePhoto ? (
        <img
          alt={`${period.periodLabel} の代表写真`}
          className="detail-panel__hero"
          src={period.representativePhoto.url}
        />
      ) : null}

      <div className="detail-panel__nav">
        <button onClick={onGoPrev} type="button">
          前の期間
        </button>
        <button onClick={onGoNext} type="button">
          次の期間
        </button>
      </div>

      <div className="detail-period-copy">
        <section>
          <span>Wish</span>
          <p>{period.representativeWish}</p>
        </section>
        <section>
          <span>Wonder at</span>
          <p>{period.representativeWonderAt}</p>
        </section>
        <section>
          <span>Wonder about</span>
          <p>{period.representativeWonderAbout}</p>
        </section>
      </div>

      <div className="detail-list">
        <h3>期間に属する日記録</h3>
        {entries.map((entry) => (
          <article className="detail-entry" key={entry.id}>
            <header className="detail-entry__header">
              <strong>{entry.date}</strong>
              <button className="ghost-button" onClick={() => onEditEntry(entry)} type="button">
                編集
              </button>
            </header>
            <p><span>Wish</span>{entry.wish}</p>
            <p><span>Wonder at</span>{entry.wonderAt}</p>
            <p><span>Wonder about</span>{entry.wonderAbout}</p>
          </article>
        ))}
      </div>
    </aside>
  )
}
