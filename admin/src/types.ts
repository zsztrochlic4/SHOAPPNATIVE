export type Kpi = { value: number; prev: number | null }

export type DayPoint = { date: string; value: number }
export type SubMrrPoint = { date: string; subscribers: number; mrr: number }

export type AnalyticsResponse = {
  rangeDays: number
  generatedAt: string
  kpis: {
    totalUsers: Kpi
    newUsers: Kpi
    activeUsers: Kpi
    avgAdherence: Kpi
    dau: Kpi
    wau: Kpi
    mau: Kpi
    mrr: Kpi
  }
  series: {
    activeUsersDaily: DayPoint[]
    newSignupsDaily: DayPoint[]
    subscribersMrr: SubMrrPoint[]
    appOpensDaily: DayPoint[]
  }
  notes: { adherenceSampled: boolean; appOpensAreProxy: boolean }
}

export type UserRow = {
  uid: string
  email: string | null
  displayName: string | null
  createdAt: number | null
  lastActive: number | null
  disabled: boolean
  subscription: string
  mrr: number
}

export type UsersResponse = { count: number; returned: number; rows: UserRow[] }

export type RangeDays = 7 | 28 | 90
