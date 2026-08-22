import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'
import type { AnalyticsResponse, RangeDays, UsersResponse } from './types'

const analyticsFn = httpsCallable<{ rangeDays: RangeDays }, AnalyticsResponse>(functions, 'adminAnalytics')
const usersFn = httpsCallable<{ limit: number }, UsersResponse>(functions, 'adminUsers')

export async function fetchAnalytics(rangeDays: RangeDays): Promise<AnalyticsResponse> {
  const res = await analyticsFn({ rangeDays })
  return res.data
}

export async function fetchUsers(limit = 500): Promise<UsersResponse> {
  const res = await usersFn({ limit })
  return res.data
}
