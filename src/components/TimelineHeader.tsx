import type { DirectionMode, TimelineMode } from '../types'

type TimelineHeaderProps = {
  directionMode: DirectionMode
  timelineMode: TimelineMode
  onChangeDirectionMode: (mode: DirectionMode) => void
  onChangeTimelineMode: (mode: TimelineMode) => void
  onJumpToToday: () => void
  onJumpToLatest: () => void
  onJumpToEarliest: () => void
  onOpenCreateEntryForm: () => void
  onOpenEditEntryForm: () => void
}

export function TimelineHeader({
  directionMode,
  timelineMode,
  onChangeDirectionMode,
  onChangeTimelineMode,
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
            className={timelineMode === 'day' ? 'is-active' : ''}
            onClick={() => onChangeTimelineMode('day')}
            type="button"
          >
            日
          </button>
          <button
            className={timelineMode === 'week' ? 'is-active' : ''}
            onClick={() => onChangeTimelineMode('week')}
            type="button"
          >
            週
          </button>
          <button
            className={timelineMode === 'month' ? 'is-active' : ''}
            onClick={() => onChangeTimelineMode('month')}
            type="button"
          >
            月
          </button>
          <button
            className={timelineMode === 'change-points' ? 'is-active' : ''}
            onClick={() => onChangeTimelineMode('change-points')}
            type="button"
          >
            変化点
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
