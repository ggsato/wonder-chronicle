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
  const touchStateRef = useRef<{
    startX: number
    startY: number
    startScrollLeft: number
    startScrollTop: number
    axis: 'x' | 'y' | null
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

    let frameId = 0
    let nestedFrameId = 0

    frameId = window.requestAnimationFrame(() => {
      nestedFrameId = window.requestAnimationFrame(() => {
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
          behavior: 'auto',
        })
      })
    })

    return () => {
      window.cancelAnimationFrame(frameId)
      window.cancelAnimationFrame(nestedFrameId)
    }
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
      if (event.pointerType !== 'mouse') {
        return
      }

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

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) {
      return
    }

    const handleTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0]
      if (!touch) {
        return
      }

      const periodElement = (event.target as HTMLElement | null)?.closest<HTMLElement>(
        '[data-period-id]',
      )

      touchStateRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        startScrollLeft: viewport.scrollLeft,
        startScrollTop: viewport.scrollTop,
        axis: null,
        moved: false,
        targetPeriodId: periodElement?.dataset.periodId,
      }
    }

    const handleTouchMove = (event: TouchEvent) => {
      const touchState = touchStateRef.current
      const touch = event.touches[0]
      if (!touchState || !touch) {
        return
      }

      const deltaX = touch.clientX - touchState.startX
      const deltaY = touch.clientY - touchState.startY

      if (!touchState.axis) {
        if (Math.abs(deltaX) < 6 && Math.abs(deltaY) < 6) {
          return
        }

        touchState.axis = Math.abs(deltaX) > Math.abs(deltaY) ? 'x' : 'y'
      }

      touchState.moved = true
      event.preventDefault()

      if (touchState.axis === 'x') {
        viewport.scrollLeft = touchState.startScrollLeft - deltaX
        return
      }

      viewport.scrollTop = touchState.startScrollTop - deltaY
    }

    const finishTouch = () => {
      const touchState = touchStateRef.current
      if (!touchState) {
        return
      }

      if (!touchState.moved && touchState.targetPeriodId) {
        onSelectPeriod(touchState.targetPeriodId)
      }

      touchStateRef.current = null
    }

    viewport.addEventListener('touchstart', handleTouchStart, { passive: true })
    viewport.addEventListener('touchmove', handleTouchMove, { passive: false })
    viewport.addEventListener('touchend', finishTouch)
    viewport.addEventListener('touchcancel', finishTouch)

    return () => {
      viewport.removeEventListener('touchstart', handleTouchStart)
      viewport.removeEventListener('touchmove', handleTouchMove)
      viewport.removeEventListener('touchend', finishTouch)
      viewport.removeEventListener('touchcancel', finishTouch)
    }
  }, [onSelectPeriod])

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
