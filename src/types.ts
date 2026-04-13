export type Granularity = 'day' | 'week' | 'month'
export type DirectionMode = 'recent-right' | 'past-right'
export type LayoutMode = 'scroll' | 'editorial'
export type InitialAnchor = 'today' | 'latest' | 'earliest' | 'last-view'
export type PeriodSelectionMap = Partial<Record<Granularity, string>>
export type TimelineMode = Granularity | 'change-points'

export type EntryPhoto = {
  id: string
  kind: 'local-object-url' | 'remote-url'
  url: string
  width?: number
  height?: number
}

export type JournalEntry = {
  id: string
  date: string
  wish: string
  wonderAt: string
  wonderAbout: string
  photos: EntryPhoto[]
}

export type ChangePoint = {
  id: string
  date: string
  text: string
}

export type AggregatedPeriod = {
  id: string
  granularity: Granularity
  startDate: string
  endDate: string
  periodLabel: string
  summaryTitle?: string
  representativeWish: string
  representativeWonderAt: string
  representativeWonderAbout: string
  representativePhoto?: EntryPhoto
  entryIds: string[]
}

export type TimelineColumnViewModel = {
  id: string
  periodId: string
  granularity: Granularity | 'change-point'
  kind: 'period' | 'change-point'
  periodLabel: string
  summaryTitle?: string
  wishText: string
  wonderAtText: string
  wonderAboutText: string
  photo?: {
    url: string
    alt: string
  }
  hasPhoto: boolean
  entryCount: number
}

export type ViewState = {
  layoutMode: LayoutMode
  directionMode: DirectionMode
  granularity: Granularity
  timelineMode: TimelineMode
  initialAnchor: InitialAnchor
  focusedPeriodIds: PeriodSelectionMap
}
