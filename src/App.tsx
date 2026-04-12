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
const MOBILE_BREAKPOINT = 767
type EntryFormMode = 'create' | 'edit'

export default function App() {
  const [entries, setEntries] = useState<JournalEntry[]>(() => normalizeEntries(sampleEntries))
  const [viewState, setViewState] = useState<ViewState>(initialViewState)
  const [, setVisiblePeriodIds] = useState<ViewState['focusedPeriodIds']>({})
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingDate, setEditingDate] = useState(todayInTokyo())
  const [entryFormMode, setEntryFormMode] = useState<EntryFormMode>('create')
  const [detailPeriodId, setDetailPeriodId] = useState<string>()
  const [isGranularitySheetOpen, setIsGranularitySheetOpen] = useState(false)
  const [isDisplaySheetOpen, setIsDisplaySheetOpen] = useState(false)
  const [isMobileLayout, setIsMobileLayout] = useState(() => getIsMobileLayout())
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
    if (typeof window === 'undefined') {
      return
    }

    const handleResize = () => {
      setIsMobileLayout(getIsMobileLayout())
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (!isMobileLayout) {
      setIsGranularitySheetOpen(false)
      setIsDisplaySheetOpen(false)
    }
  }, [isMobileLayout])

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

  const editingEntry =
    entryFormMode === 'edit'
      ? entries.find((entry) => entry.date === editingDate)
      : undefined

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
    setIsGranularitySheetOpen(false)
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
    if (isMobileLayout) {
      setDetailPeriodId(undefined)
      setIsDisplaySheetOpen(false)
    }
  }

  const handleSave = (entry: JournalEntry) => {
    const duplicate = entries.find((item) => item.date === entry.date && item.id !== entry.id)
    if (duplicate) {
      return 'その日付には既に記録があります。別の日付を選んでください。'
    }

    setEntries((current) => {
      const existing = current.find((item) => item.id === entry.id)
      if (existing) {
        revokeLocalUrls(
          existing.photos.filter((photo) => photo.kind === 'local-object-url'),
        )
      }

      const filtered = current.filter((item) => item.id !== entry.id)
      return normalizeEntries([...filtered, entry])
    })
    setEditingDate(entry.date)
    setIsFormOpen(false)
    return undefined
  }

  const handleOpenCreateEntryForm = () => {
    setEntryFormMode('create')
    setEditingDate(todayInTokyo())
    setIsFormOpen(true)
  }

  const handleOpenEditEntryForm = () => {
    setEntryFormMode('edit')
    setEditingDate(resolveEditingDate(viewState.focusedPeriodIds, periodsByGranularity))
    setIsFormOpen(true)
  }

  const handleChangeDirectionMode = (directionMode: ViewState['directionMode']) => {
    setViewState((current) => ({ ...current, directionMode }))
    if (isMobileLayout) {
      setDetailPeriodId(undefined)
      setIsDisplaySheetOpen(false)
    }
  }

  const handleOpenGranularitySheet = () => {
    setDetailPeriodId(undefined)
    setIsDisplaySheetOpen(false)
    setIsGranularitySheetOpen(true)
  }

  const handleOpenDisplaySheet = () => {
    setDetailPeriodId(undefined)
    setIsGranularitySheetOpen(false)
    setIsDisplaySheetOpen(true)
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
      <div className="desktop-header">
        <TimelineHeader
          directionMode={viewState.directionMode}
          granularity={viewState.granularity}
          onChangeDirectionMode={handleChangeDirectionMode}
          onChangeGranularity={handleChangeGranularity}
          onJumpToToday={() => handleJump('today')}
          onJumpToLatest={() => handleJump('latest')}
          onJumpToEarliest={() => handleJump('earliest')}
          onOpenCreateEntryForm={handleOpenCreateEntryForm}
          onOpenEditEntryForm={handleOpenEditEntryForm}
        />
      </div>

      <section className="mobile-topbar">
        <div className="mobile-topbar__brand">
          <p className="timeline-brand__eyebrow">Vertical self-chronicle</p>
          <h1>Wonder Chronicle</h1>
        </div>
        <button className="mobile-period-button" onClick={handleOpenGranularitySheet} type="button">
          {currentPeriodLabel}
        </button>
        <div className="mobile-entry-actions">
          <button className="ghost-button mobile-edit-button" onClick={handleOpenEditEntryForm} type="button">
            編集する
          </button>
          <button className="record-button mobile-record-button" onClick={handleOpenCreateEntryForm} type="button">
            追加する
          </button>
        </div>
      </section>

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

          <div className="mobile-secondary-actions">
            <button className="ghost-button mobile-display-button" onClick={handleOpenDisplaySheet} type="button">
              表示
            </button>
          </div>
        </section>

        {!isMobileLayout && detailPeriod ? (
          <EntryDetail
            entries={detailEntries}
            onBack={() => setDetailPeriodId(undefined)}
            onEditEntry={(entry) => {
              setEntryFormMode('edit')
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
        ) : !isMobileLayout ? (
          <aside className="detail-panel detail-panel--empty">
            <p className="panel__eyebrow">Detail</p>
            <h2>期間を開く</h2>
            <p>
              年表の列を選ぶと、その期間の3W全文と日記録一覧をここに表示します。
            </p>
          </aside>
        ) : null}
      </main>

      {isFormOpen ? (
        <EntryForm
          existingEntry={editingEntry}
          initialDate={editingDate}
          mode={entryFormMode}
          onCancel={() => setIsFormOpen(false)}
          onSave={handleSave}
        />
      ) : null}

      {isMobileLayout && isGranularitySheetOpen ? (
        <div className="overlay overlay--sheet">
          <div className="panel panel--sheet">
            <div className="panel__header">
              <div>
                <p className="panel__eyebrow">Granularity</p>
                <h2>表示単位を選ぶ</h2>
              </div>
              <button className="panel__close" onClick={() => setIsGranularitySheetOpen(false)} type="button">
                閉じる
              </button>
            </div>

            <div className="sheet-option-list">
              {GRANULARITIES.map((granularity) => (
                <button
                  className={viewState.granularity === granularity ? 'is-active' : ''}
                  key={granularity}
                  onClick={() => handleChangeGranularity(granularity)}
                  type="button"
                >
                  {granularity === 'day' ? '日' : granularity === 'week' ? '週' : '月'}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {isMobileLayout && isDisplaySheetOpen ? (
        <div className="overlay overlay--sheet">
          <div className="panel panel--sheet">
            <div className="panel__header">
              <div>
                <p className="panel__eyebrow">Display</p>
                <h2>表示オプション</h2>
              </div>
              <button className="panel__close" onClick={() => setIsDisplaySheetOpen(false)} type="button">
                閉じる
              </button>
            </div>

            <div className="sheet-section">
              <span>向き</span>
              <div className="control-group">
                <button
                  className={viewState.directionMode === 'recent-right' ? 'is-active' : ''}
                  onClick={() => handleChangeDirectionMode('recent-right')}
                  type="button"
                >
                  右=現在
                </button>
                <button
                  className={viewState.directionMode === 'past-right' ? 'is-active' : ''}
                  onClick={() => handleChangeDirectionMode('past-right')}
                  type="button"
                >
                  右=過去
                </button>
              </div>
            </div>

            <div className="sheet-section">
              <span>ジャンプ</span>
              <div className="sheet-option-list sheet-option-list--compact">
                <button onClick={() => handleJump('today')} type="button">
                  today
                </button>
                <button onClick={() => handleJump('latest')} type="button">
                  latest
                </button>
                <button onClick={() => handleJump('earliest')} type="button">
                  earliest
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isMobileLayout && detailPeriod ? (
        <div className="overlay overlay--sheet">
          <EntryDetail
            entries={detailEntries}
            onBack={() => setDetailPeriodId(undefined)}
            onEditEntry={(entry) => {
              setEntryFormMode('edit')
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
            variant="sheet"
          />
        </div>
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

function getIsMobileLayout() {
  return typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT
}

function resolveEditingDate(
  focusedPeriodIds: PeriodSelectionMap,
  periodsByGranularity: Record<Granularity, AggregatedPeriod[]>,
) {
  const selectedDayId = focusedPeriodIds.day
  const selectedDay = selectedDayId
    ? periodsByGranularity.day.find((period) => period.id === selectedDayId)
    : undefined

  return selectedDay?.startDate ?? todayInTokyo()
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
