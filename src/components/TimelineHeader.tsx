import type { DirectionMode, Granularity } from '../types'

type TimelineHeaderProps = {
  directionMode: DirectionMode
  granularity: Granularity
  onChangeDirectionMode: (mode: DirectionMode) => void
  onChangeGranularity: (granularity: Granularity) => void
  onJumpToToday: () => void
  onJumpToLatest: () => void
  onJumpToEarliest: () => void
  onOpenCreateEntryForm: () => void
  onOpenEditEntryForm: () => void
}

export function TimelineHeader({
  directionMode,
  granularity,
  onChangeDirectionMode,
  onChangeGranularity,
  onJumpToToday,
  onJumpToLatest,
  onJumpToEarliest,
  onOpenCreateEntryForm,
  onOpenEditEntryForm,
}: TimelineHeaderProps) {
  return (
    <header className="timeline-header">
      <div className="timeline-brand">
        <p className="timeline-brand__eyebrow">Vertical self-chronicle</p>
        <h1>Wonder Chronicle</h1>
      </div>

      <div className="timeline-controls">
        <div className="control-group" aria-label="時間の向き">
          <button
            className={directionMode === 'recent-right' ? 'is-active' : ''}
            onClick={() => onChangeDirectionMode('recent-right')}
            type="button"
          >
            右=現在
          </button>
          <button
            className={directionMode === 'past-right' ? 'is-active' : ''}
            onClick={() => onChangeDirectionMode('past-right')}
            type="button"
          >
            右=過去
          </button>
        </div>

        <div className="control-group" aria-label="粒度">
          <button
            className={granularity === 'day' ? 'is-active' : ''}
            onClick={() => onChangeGranularity('day')}
            type="button"
          >
            日
          </button>
          <button
            className={granularity === 'week' ? 'is-active' : ''}
            onClick={() => onChangeGranularity('week')}
            type="button"
          >
            週
          </button>
          <button
            className={granularity === 'month' ? 'is-active' : ''}
            onClick={() => onChangeGranularity('month')}
            type="button"
          >
            月
          </button>
        </div>

        <div className="control-group" aria-label="起点移動">
          <button onClick={onJumpToToday} type="button">
            today
          </button>
          <button onClick={onJumpToLatest} type="button">
            latest
          </button>
          <button onClick={onJumpToEarliest} type="button">
            earliest
          </button>
        </div>

        <div className="entry-actions">
          <button className="ghost-button" onClick={onOpenEditEntryForm} type="button">
            編集する
          </button>
          <button className="record-button" onClick={onOpenCreateEntryForm} type="button">
            追加する
          </button>
        </div>
      </div>
    </header>
  )
}
