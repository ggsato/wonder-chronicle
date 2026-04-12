import { useEffect, useMemo, useRef } from 'react'
import type { DirectionMode, TimelineColumnViewModel } from '../types'
import { TimelineColumn } from './TimelineColumn'

type TimelineViewportProps = {
  columns: TimelineColumnViewModel[]
  directionMode: DirectionMode
  centeredPeriodId?: string
  selectedPeriodId?: string
  onSelectPeriod: (periodId: string) => void
  onVisiblePeriodChange: (periodId: string) => void
}

export function TimelineViewport({
  columns,
  directionMode,
  centeredPeriodId,
  selectedPeriodId,
  onSelectPeriod,
  onVisiblePeriodChange,
}: TimelineViewportProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const onVisiblePeriodChangeRef = useRef(onVisiblePeriodChange)
  const dragStateRef = useRef<{
    pointerId: number
    startX: number
    startScrollLeft: number
    moved: boolean
    targetPeriodId?: string
  } | null>(null)

  const visiblePeriodId = useMemo(
    () => centeredPeriodId ?? columns[0]?.periodId,
    [centeredPeriodId, columns],
  )

  useEffect(() => {
    onVisiblePeriodChangeRef.current = onVisiblePeriodChange
  }, [onVisiblePeriodChange])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || !visiblePeriodId) {
      return
    }

    const target = viewport.querySelector<HTMLElement>(
      `[data-period-id="${visiblePeriodId}"]`,
    )
    if (!target) {
      return
    }

    const offset =
      target.offsetLeft - viewport.clientWidth / 2 + target.clientWidth / 2
    viewport.scrollTo({
      left: Math.max(offset, 0),
      behavior: 'smooth',
    })
  }, [visiblePeriodId, directionMode, columns])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) {
      return
    }

    const updateVisible = () => {
      const center = viewport.scrollLeft + viewport.clientWidth / 2
      let closestId = columns[0]?.periodId
      let minDistance = Number.POSITIVE_INFINITY

      for (const element of viewport.querySelectorAll<HTMLElement>('[data-period-id]')) {
        const midpoint = element.offsetLeft + element.clientWidth / 2
        const distance = Math.abs(midpoint - center)
        if (distance < minDistance) {
          minDistance = distance
          closestId = element.dataset.periodId ?? closestId
        }
      }

      if (closestId) {
        onVisiblePeriodChangeRef.current(closestId)
      }
    }

    updateVisible()
    viewport.addEventListener('scroll', updateVisible, { passive: true })
    window.addEventListener('resize', updateVisible)

    return () => {
      viewport.removeEventListener('scroll', updateVisible)
      window.removeEventListener('resize', updateVisible)
    }
  }, [columns])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return
      }

      const periodElement = (event.target as HTMLElement | null)?.closest<HTMLElement>(
        '[data-period-id]',
      )

      dragStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startScrollLeft: viewport.scrollLeft,
        moved: false,
        targetPeriodId: periodElement?.dataset.periodId,
      }
      viewport.classList.add('is-dragging')
      viewport.setPointerCapture(event.pointerId)
    }

    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return
      }

      const deltaX = event.clientX - dragState.startX
      if (Math.abs(deltaX) > 3) {
        dragState.moved = true
      }
      viewport.scrollLeft = dragState.startScrollLeft - deltaX
    }

    const finishDrag = (event: PointerEvent) => {
      const dragState = dragStateRef.current
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return
      }

      if (dragState.moved) {
        event.preventDefault()
      } else if (dragState.targetPeriodId) {
        onSelectPeriod(dragState.targetPeriodId)
      }

      dragStateRef.current = null
      viewport.classList.remove('is-dragging')
      if (viewport.hasPointerCapture(event.pointerId)) {
        viewport.releasePointerCapture(event.pointerId)
      }
    }

    viewport.addEventListener('pointerdown', handlePointerDown)
    viewport.addEventListener('pointermove', handlePointerMove)
    viewport.addEventListener('pointerup', finishDrag)
    viewport.addEventListener('pointercancel', finishDrag)

    return () => {
      viewport.removeEventListener('pointerdown', handlePointerDown)
      viewport.removeEventListener('pointermove', handlePointerMove)
      viewport.removeEventListener('pointerup', finishDrag)
      viewport.removeEventListener('pointercancel', finishDrag)
    }
  }, [])

  return (
    <div className="timeline-shell">
      <div className="timeline-viewport" ref={viewportRef}>
        <div className="timeline-track">
          {columns.map((column) => (
            <TimelineColumn
              key={column.id}
              column={column}
              granularity={column.granularity}
              isFocused={column.periodId === selectedPeriodId}
              onClick={() => onSelectPeriod(column.periodId)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
