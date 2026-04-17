import { useEffect, useMemo, useRef, useState } from 'react'
import { EntryDetail } from './components/EntryDetail'
import { EntryForm } from './components/EntryForm'
import { TimelineHeader } from './components/TimelineHeader'
import { TimelineViewport } from './components/TimelineViewport'
import { sampleEntries } from './data/sampleEntries'
import { generateChangePoints, toChangePointColumns } from './lib/ai'
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
  ChangePoint,
  TimelineMode,
  ViewState,
} from './types'

const initialViewState: ViewState = {
  layoutMode: 'scroll',
  directionMode: 'recent-right',
  granularity: 'day',
  timelineMode: 'day',
  initialAnchor: 'today',
  focusedPeriodIds: {},
}

const anchorForMvp = (anchor: InitialAnchor): 'today' | 'latest' | 'earliest' =>
  anchor === 'last-view' ? 'today' : anchor

const GRANULARITIES: Granularity[] = ['day', 'week', 'month']
const CHANGE_POINT_COUNT_OPTIONS = [3, 5, 10] as const
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
  const [changePoints, setChangePoints] = useState<ChangePoint[]>([])
  const [isGeneratingChangePoints, setIsGeneratingChangePoints] = useState(false)
  const [changePointError, setChangePointError] = useState<string>()
  const [changePointStatusMessage, setChangePointStatusMessage] = useState<string>()
  const [changePointCount, setChangePointCount] = useState<(typeof CHANGE_POINT_COUNT_OPTIONS)[number]>(5)
  const [isChangePointDialogOpen, setIsChangePointDialogOpen] = useState(false)
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
  const changePointColumns = useMemo(() => toChangePointColumns(changePoints), [changePoints])
  const renderedColumns = useMemo(
    () =>
      toRenderedColumns(
        viewState.timelineMode === 'change-points' ? changePointColumns : columns,
        viewState.directionMode,
      ),
    [changePointColumns, columns, viewState.directionMode, viewState.timelineMode],
  )

  useEffect(() => {
    latestEntriesRef.current = entries
  }, [entries])

  useEffect(() => {
    setChangePoints([])
    setChangePointError(undefined)
    setChangePointStatusMessage(undefined)
    setIsChangePointDialogOpen(false)
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

  const handleChangeTimelineMode = (mode: TimelineMode) => {
    if (mode === 'change-points') {
      setViewState((current) => ({ ...current, timelineMode: mode }))
      setDetailPeriodId(undefined)
      setIsGranularitySheetOpen(false)
      if (changePoints.length === 0 && !isGeneratingChangePoints) {
        handleOpenChangePointDialog()
      }
      return
    }

    setViewState((current) => ({ ...current, timelineMode: mode }))
    handleChangeGranularity(mode)
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

  const handleOpenChangePointDialog = () => {
    setChangePointError(undefined)
    setIsChangePointDialogOpen(true)
  }

  const currentPeriodLabel = focusedPeriod?.periodLabel ?? '年表を準備中'
  const currentPeriodIndex = getPeriodIndexById(periods, detailPeriodId ?? focusedPeriod?.id)
  const detailPeriod = detailPeriodId
    ? periods.find((period) => period.id === detailPeriodId)
    : undefined
  const detailEntries = detailPeriod
    ? entries.filter((entry) => detailPeriod.entryIds.includes(entry.id))
    : []
  const handleGenerateChangePoints = async () => {
    setIsGeneratingChangePoints(true)
    setChangePointError(undefined)
    setChangePointStatusMessage(
      `既存の記録群から最大${changePointCount}件の変化の節目を抽出しています。`,
    )
    setIsChangePointDialogOpen(false)

    try {
      const nextChangePoints = await generateChangePoints(entries, changePointCount)
      setChangePoints(nextChangePoints)
      if (nextChangePoints.length === 0) {
        setChangePointStatusMessage(
          '変化点は抽出されませんでした。記録を増やしてから再試行してください。',
        )
      } else {
        setChangePointStatusMessage(
          `${nextChangePoints.length}件の変化点を抽出しました。`,
        )
      }
    } catch (error) {
      setChangePointError(
        error instanceof Error ? error.message : '変化点の生成に失敗しました。',
      )
      setChangePointStatusMessage(undefined)
    } finally {
      setIsGeneratingChangePoints(false)
    }
  }

  return (
    <div className="app-shell">
      <div className="desktop-header">
        <TimelineHeader
          directionMode={viewState.directionMode}
          timelineMode={viewState.timelineMode}
          onChangeDirectionMode={handleChangeDirectionMode}
          onChangeTimelineMode={handleChangeTimelineMode}
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
          {viewState.timelineMode === 'change-points' ? '変化点年表' : currentPeriodLabel}
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

      <main
        className={`timeline-page ${
          viewState.timelineMode === 'change-points' ? 'timeline-page--single' : ''
        }`}
      >
        <section className="timeline-main">
          <div className="timeline-nav">
            <span className="timeline-nav__label">Selected Period</span>
            <strong>
              {viewState.timelineMode === 'change-points' ? '変化点年表' : currentPeriodLabel}
            </strong>
            <p>
              {viewState.timelineMode === 'change-points' && changePointError ? (
                <span className="timeline-nav__sub timeline-nav__sub--error">{changePointError}</span>
              ) : null}
              {viewState.timelineMode === 'change-points' && !changePointError && changePointStatusMessage ? (
                <span className="timeline-nav__sub">{changePointStatusMessage}</span>
              ) : null}
              {viewState.directionMode === 'recent-right' ? '右が現在' : '右が過去'}
            </p>
          </div>

          <TimelineViewport
            columns={renderedColumns}
            directionMode={viewState.directionMode}
            centeredPeriodId={viewState.timelineMode === 'change-points' ? undefined : selectedPeriodId}
            selectedPeriodId={viewState.timelineMode === 'change-points' ? undefined : selectedPeriodId}
            selectable
            enableMouseDrag={viewState.timelineMode !== 'change-points'}
            overlayContent={
              viewState.timelineMode === 'change-points' && isGeneratingChangePoints ? (
                <div className="timeline-loading-card">
                  <p className="panel__eyebrow">Generating</p>
                  <h2>変化点を生成しています</h2>
                  <p>既存の記録群から変化の節目を抽出しています。しばらくお待ちください。</p>
                </div>
              ) : undefined
            }
            onSelectPeriod={(periodId) => {
              if (viewState.timelineMode === 'change-points') {
                const clickedPoint = changePoints.find((point) => point.id === periodId)
                if (!clickedPoint) {
                  return
                }

                const nextDayPeriodId = `day:${clickedPoint.date}`
                if (!periodsByGranularity.day.some((period) => period.id === nextDayPeriodId)) {
                  return
                }

                const nextSelections = syncPeriodSelections(
                  'day',
                  nextDayPeriodId,
                  viewState.focusedPeriodIds,
                  periodsByGranularity,
                )

                setViewState((current) => ({
                  ...current,
                  timelineMode: 'day',
                  granularity: 'day',
                  initialAnchor: 'latest',
                  focusedPeriodIds: nextSelections,
                }))
                setVisiblePeriodIds(nextSelections)
                setDetailPeriodId(nextDayPeriodId)
                setIsDisplaySheetOpen(false)
                setIsGranularitySheetOpen(false)
                return
              }

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
              viewState.timelineMode === 'change-points'
                ? undefined
                : setVisiblePeriodIds((current) =>
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

        {!isMobileLayout && viewState.timelineMode !== 'change-points' && detailPeriod ? (
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
        ) : !isMobileLayout && viewState.timelineMode !== 'change-points' ? (
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
                  className={viewState.timelineMode === granularity ? 'is-active' : ''}
                  key={granularity}
                  onClick={() => handleChangeTimelineMode(granularity)}
                  type="button"
                >
                  {granularity === 'day' ? '日' : granularity === 'week' ? '週' : '月'}
                </button>
              ))}
              <button
                className={viewState.timelineMode === 'change-points' ? 'is-active' : ''}
                onClick={() => handleChangeTimelineMode('change-points')}
                type="button"
              >
                変化点
              </button>
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

            {viewState.timelineMode === 'change-points' ? (
              <div className="sheet-section">
                <span>AI</span>
                <div className="sheet-option-list">
                  <button onClick={handleOpenChangePointDialog} type="button">
                    {isGeneratingChangePoints ? '生成中…' : '抽出条件を開く'}
                  </button>
                  {changePointError ? (
                    <p className="sheet-message is-error">{changePointError}</p>
                  ) : changePointStatusMessage ? (
                    <p className="sheet-message">{changePointStatusMessage}</p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {isMobileLayout && viewState.timelineMode !== 'change-points' && detailPeriod ? (
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

      {isChangePointDialogOpen ? (
        <div className="overlay">
          <div className="panel panel--dialog">
            <div className="panel__header">
              <div>
                <p className="panel__eyebrow">Change Points</p>
                <h2>変化点年表を生成する</h2>
              </div>
              <button
                className="panel__close"
                onClick={() => {
                  setIsChangePointDialogOpen(false)
                  setChangePointStatusMessage(
                    '未生成です。必要になったら再度 `変化点` モードを開いてください。',
                  )
                }}
                type="button"
              >
                閉じる
              </button>
            </div>

            <div className="sheet-section">
              <span>説明</span>
              <p className="dialog-copy">
                既存の記録群から最大{changePointCount}件の変化の節目を抽出します。
              </p>
            </div>

            <div className="sheet-section">
              <span>抽出件数</span>
              <div className="control-group">
                {CHANGE_POINT_COUNT_OPTIONS.map((count) => (
                  <button
                    className={changePointCount === count ? 'is-active' : ''}
                    key={count}
                    onClick={() => setChangePointCount(count)}
                    type="button"
                  >
                    {count}件
                  </button>
                ))}
              </div>
            </div>

            <div className="entry-form__actions">
              <button
                className="ghost-button"
                onClick={() => {
                  setIsChangePointDialogOpen(false)
                  setChangePointStatusMessage(
                    '未生成です。必要になったら再度 `変化点` モードを開いてください。',
                  )
                }}
                type="button"
              >
                いまは生成しない
              </button>
              <button className="primary-button" onClick={() => void handleGenerateChangePoints()} type="button">
                生成する
              </button>
            </div>
          </div>
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
