import { useEffect, useMemo, useRef, useState } from 'react'
import { EntryDetail } from './components/EntryDetail'
import { EntryForm } from './components/EntryForm'
import { TimelineHeader } from './components/TimelineHeader'
import { TimelineViewport } from './components/TimelineViewport'
import { sampleEntries } from './data/sampleEntries'
import { todayInTokyo } from './lib/date'
import {
  aggregateEntries,
  getPeriodIndexById,
  normalizeEntries,
  resolveAnchorPeriodId,
  toColumnViewModels,
  toRenderedColumns,
} from './lib/timeline'
import type {
  AggregatedPeriod,
  EntryPhoto,
  Granularity,
  InitialAnchor,
  JournalEntry,
  PeriodSelectionMap,
  ViewState,
} from './types'

const initialViewState: ViewState = {
  layoutMode: 'scroll',
  directionMode: 'recent-right',
  granularity: 'day',
  initialAnchor: 'today',
  focusedPeriodIds: {},
}

const anchorForMvp = (anchor: InitialAnchor): 'today' | 'latest' | 'earliest' =>
  anchor === 'last-view' ? 'today' : anchor

const GRANULARITIES: Granularity[] = ['day', 'week', 'month']

export default function App() {
  const [entries, setEntries] = useState<JournalEntry[]>(() => normalizeEntries(sampleEntries))
  const [viewState, setViewState] = useState<ViewState>(initialViewState)
  const [, setVisiblePeriodIds] = useState<ViewState['focusedPeriodIds']>({})
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingDate, setEditingDate] = useState(todayInTokyo())
  const [detailPeriodId, setDetailPeriodId] = useState<string>()
  const latestEntriesRef = useRef(entries)

  const periods = useMemo(
    () => aggregateEntries(entries, viewState.granularity),
    [entries, viewState.granularity],
  )
  const periodsByGranularity = useMemo(
    () => ({
      day: aggregateEntries(entries, 'day'),
      week: aggregateEntries(entries, 'week'),
      month: aggregateEntries(entries, 'month'),
    }),
    [entries],
  )
  const columns = useMemo(() => toColumnViewModels(periods), [periods])
  const renderedColumns = useMemo(
    () => toRenderedColumns(columns, viewState.directionMode),
    [columns, viewState.directionMode],
  )

  useEffect(() => {
    latestEntriesRef.current = entries
  }, [entries])

  useEffect(() => {
    if (periods.length === 0) {
      return
    }

    setViewState((current) => {
      const currentFocusedPeriodId = current.focusedPeriodIds[current.granularity]
      if (
        currentFocusedPeriodId &&
        periods.some((period) => period.id === currentFocusedPeriodId)
      ) {
        return current
      }

      const fallbackAnchor = anchorForMvp(current.initialAnchor)
      const focusedPeriodId = resolveAnchorPeriodId(
        periods,
        current.granularity,
        fallbackAnchor,
      )

      return {
        ...current,
        focusedPeriodIds: {
          ...current.focusedPeriodIds,
          [current.granularity]: focusedPeriodId,
        },
      }
    })
    setVisiblePeriodIds((currentVisibleIds) => {
      const currentVisiblePeriodId = currentVisibleIds[viewState.granularity]
      const nextVisiblePeriodId =
        currentVisiblePeriodId && periods.some((period) => period.id === currentVisiblePeriodId)
          ? currentVisiblePeriodId
          : resolveAnchorPeriodId(
              periods,
              viewState.granularity,
              anchorForMvp(viewState.initialAnchor),
            )

      if (currentVisiblePeriodId === nextVisiblePeriodId) {
        return currentVisibleIds
      }

      return {
        ...currentVisibleIds,
        [viewState.granularity]: nextVisiblePeriodId,
      }
    })
  }, [periods, viewState.granularity, viewState.initialAnchor])

  useEffect(() => {
    return () => {
      revokeLocalUrls(latestEntriesRef.current.flatMap((entry) => entry.photos))
    }
  }, [])

  const focusedPeriodId = viewState.focusedPeriodIds[viewState.granularity]
  const selectedPeriodId =
    detailPeriodId && periods.some((period) => period.id === detailPeriodId)
      ? detailPeriodId
      : focusedPeriodId
  const focusedPeriod = periods.find((period) => period.id === selectedPeriodId) ?? periods[0]

  const focusedEntries = useMemo(() => {
    if (!focusedPeriod) {
      return []
    }

    const idSet = new Set(focusedPeriod.entryIds)
    return entries.filter((entry) => idSet.has(entry.id))
  }, [entries, focusedPeriod])

  const editingEntry = entries.find((entry) => entry.date === editingDate)

  const handleChangeGranularity = (granularity: ViewState['granularity']) => {
    const nextPeriods = periodsByGranularity[granularity]
    const sourcePeriodId = selectedPeriodId
    const sourcePeriod = sourcePeriodId
      ? periods.find((period) => period.id === sourcePeriodId)
      : undefined
    const rememberedFocusedPeriodId = viewState.focusedPeriodIds[granularity]
    const nextFocusedPeriodId =
      (sourcePeriod &&
      rememberedFocusedPeriodId &&
      canReuseSelection(rememberedFocusedPeriodId, sourcePeriod, nextPeriods)
        ? rememberedFocusedPeriodId
        : sourcePeriod
          ? resolveCompatibleOrSyncedPeriodId(
              rememberedFocusedPeriodId,
              sourcePeriod,
              nextPeriods,
            )
          : undefined) ??
      resolveAnchorPeriodId(nextPeriods, granularity, anchorForMvp(viewState.initialAnchor))

    setViewState((current) => {
      return {
        ...current,
        granularity,
        focusedPeriodIds: {
          ...current.focusedPeriodIds,
          [granularity]: nextFocusedPeriodId,
        },
      }
    })
    setVisiblePeriodIds((current) => ({
      ...current,
      [granularity]: nextFocusedPeriodId,
    }))
  }

  const handleJump = (anchor: 'today' | 'latest' | 'earliest') => {
    const targetPeriodId = resolveAnchorPeriodId(periods, viewState.granularity, anchor)
    const nextSelections = syncPeriodSelections(
      viewState.granularity,
      targetPeriodId,
      viewState.focusedPeriodIds,
      periodsByGranularity,
    )

    setViewState((current) => ({
      ...current,
      initialAnchor: anchor,
      focusedPeriodIds: nextSelections,
    }))
    setVisiblePeriodIds(nextSelections)
  }

  const handleSave = (entry: JournalEntry) => {
    setEntries((current) => {
      const existing = current.find((item) => item.date === entry.date)
      if (existing) {
        revokeLocalUrls(
          existing.photos.filter((photo) => photo.kind === 'local-object-url'),
        )
      }

      const filtered = current.filter((item) => item.date !== entry.date)
      return normalizeEntries([...filtered, entry])
    })
    setEditingDate(entry.date)
    setIsFormOpen(false)
  }

  const handleOpenEntryForm = () => {
    setEditingDate(focusedEntries[0]?.date ?? todayInTokyo())
    setIsFormOpen(true)
  }

  const currentPeriodLabel = focusedPeriod?.periodLabel ?? '年表を準備中'
  const currentPeriodIndex = getPeriodIndexById(periods, detailPeriodId ?? focusedPeriod?.id)
  const detailPeriod = detailPeriodId
    ? periods.find((period) => period.id === detailPeriodId)
    : undefined
  const detailEntries = detailPeriod
    ? entries.filter((entry) => detailPeriod.entryIds.includes(entry.id))
    : []

  return (
    <div className="app-shell">
      <TimelineHeader
        directionMode={viewState.directionMode}
        granularity={viewState.granularity}
        onChangeDirectionMode={(directionMode) =>
          setViewState((current) => ({ ...current, directionMode }))
        }
        onChangeGranularity={handleChangeGranularity}
        onJumpToToday={() => handleJump('today')}
        onJumpToLatest={() => handleJump('latest')}
        onJumpToEarliest={() => handleJump('earliest')}
        onOpenEntryForm={handleOpenEntryForm}
      />

      <main className="timeline-page">
        <section className="timeline-main">
          <div className="timeline-nav">
            <span className="timeline-nav__label">Selected Period</span>
            <strong>{currentPeriodLabel}</strong>
            <p>{viewState.directionMode === 'recent-right' ? '右が現在' : '右が過去'}</p>
          </div>

          <TimelineViewport
            columns={renderedColumns}
            directionMode={viewState.directionMode}
            centeredPeriodId={selectedPeriodId}
            selectedPeriodId={selectedPeriodId}
            onSelectPeriod={(periodId) => {
              const nextSelections = syncPeriodSelections(
                viewState.granularity,
                periodId,
                viewState.focusedPeriodIds,
                periodsByGranularity,
              )

              setViewState((current) => ({
                ...current,
                focusedPeriodIds: nextSelections,
              }))
              setVisiblePeriodIds(nextSelections)
              setDetailPeriodId(nextSelections[viewState.granularity] ?? periodId)
            }}
            onVisiblePeriodChange={(periodId) =>
              setVisiblePeriodIds((current) =>
                current[viewState.granularity] === periodId
                  ? current
                  : {
                      ...current,
                      [viewState.granularity]: periodId,
                    },
              )
            }
          />
        </section>

        {detailPeriod ? (
          <EntryDetail
            entries={detailEntries}
            onBack={() => setDetailPeriodId(undefined)}
            onEditEntry={(entry) => {
              setEditingDate(entry.date)
              setIsFormOpen(true)
            }}
            onGoNext={() => {
              const next = periods[currentPeriodIndex + 1]
              if (next) {
                const nextSelections = syncPeriodSelections(
                  viewState.granularity,
                  next.id,
                  viewState.focusedPeriodIds,
                  periodsByGranularity,
                )
                setDetailPeriodId(next.id)
                setViewState((current) => ({
                  ...current,
                  focusedPeriodIds: nextSelections,
                }))
                setVisiblePeriodIds(nextSelections)
              }
            }}
            onGoPrev={() => {
              const previous = periods[currentPeriodIndex - 1]
              if (previous) {
                const nextSelections = syncPeriodSelections(
                  viewState.granularity,
                  previous.id,
                  viewState.focusedPeriodIds,
                  periodsByGranularity,
                )
                setDetailPeriodId(previous.id)
                setViewState((current) => ({
                  ...current,
                  focusedPeriodIds: nextSelections,
                }))
                setVisiblePeriodIds(nextSelections)
              }
            }}
            period={detailPeriod}
          />
        ) : (
          <aside className="detail-panel detail-panel--empty">
            <p className="panel__eyebrow">Detail</p>
            <h2>期間を開く</h2>
            <p>
              年表の列を選ぶと、その期間の3W全文と日記録一覧をここに表示します。
            </p>
          </aside>
        )}
      </main>

      {isFormOpen ? (
        <EntryForm
          existingEntry={editingEntry}
          initialDate={editingDate}
          onCancel={() => setIsFormOpen(false)}
          onSave={handleSave}
        />
      ) : null}
    </div>
  )
}

function revokeLocalUrls(photos: EntryPhoto[]) {
  for (const photo of photos) {
    if (photo.kind === 'local-object-url') {
      URL.revokeObjectURL(photo.url)
    }
  }
}

function syncPeriodSelections(
  sourceGranularity: Granularity,
  sourcePeriodId: string | undefined,
  currentSelections: PeriodSelectionMap,
  periodsByGranularity: Record<Granularity, AggregatedPeriod[]>,
): PeriodSelectionMap {
  if (!sourcePeriodId) {
    return {}
  }

  const sourcePeriods = periodsByGranularity[sourceGranularity]
  const sourcePeriod = sourcePeriods.find((period) => period.id === sourcePeriodId)
  if (!sourcePeriod) {
    return {}
  }

  return Object.fromEntries(
    GRANULARITIES.map((granularity) => [
      granularity,
      granularity === sourceGranularity
        ? sourcePeriod.id
        : resolveCompatibleOrSyncedPeriodId(
            currentSelections[granularity],
            sourcePeriod,
            periodsByGranularity[granularity],
          ),
    ]),
  )
}

function resolveCompatibleOrSyncedPeriodId(
  currentPeriodId: string | undefined,
  sourcePeriod: AggregatedPeriod,
  targetPeriods: AggregatedPeriod[],
): string | undefined {
  if (currentPeriodId) {
    const currentPeriod = targetPeriods.find((period) => period.id === currentPeriodId)
    if (currentPeriod && periodsShareEntries(currentPeriod, sourcePeriod)) {
      return currentPeriod.id
    }
  }

  if (sourcePeriod.entryIds.length === 0) {
    return undefined
  }

  const sourceEntryIds = new Set(sourcePeriod.entryIds)
  return targetPeriods.find((period) =>
    period.entryIds.some((entryId) => sourceEntryIds.has(entryId)),
  )?.id
}

function periodsShareEntries(left: AggregatedPeriod, right: AggregatedPeriod): boolean {
  const rightEntryIds = new Set(right.entryIds)
  return left.entryIds.some((entryId) => rightEntryIds.has(entryId))
}

function canReuseSelection(
  periodId: string,
  sourcePeriod: AggregatedPeriod,
  targetPeriods: AggregatedPeriod[],
): boolean {
  const targetPeriod = targetPeriods.find((period) => period.id === periodId)
  return Boolean(targetPeriod && periodsShareEntries(targetPeriod, sourcePeriod))
}
