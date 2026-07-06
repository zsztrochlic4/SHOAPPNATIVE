import { useEffect, useRef, useState, type ReactNode } from 'react'
import { View, Text, Pressable, ActivityIndicator } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { makeRedirectUri, useAuthRequest, type AuthRequestConfig } from 'expo-auth-session'
import { Zap, HeartPulse, Activity, Watch, RefreshCw } from 'lucide-react-native'
import { useStore } from '../store/store'
import { useToast } from './Toast'
import {
  PROVIDERS, OAUTH_CLIENT_IDS, OAUTH_ENDPOINTS, providerAvailable,
  exchangeToken, syncAll, lastSyncLabel, type Provider, type ProviderId,
} from '../lib/integrations'
import { brand, accent } from '../theme'

WebBrowser.maybeCompleteAuthSession()

const ICONS: Record<ProviderId, ReactNode> = {
  strava: <Zap size={18} color={accent.orange} />,
  whoop: <Activity size={18} color={brand[400]} />,
  appleHealth: <HeartPulse size={18} color="#f87171" />,
  healthConnect: <Activity size={18} color={accent.blue} />,
  garmin: <Watch size={18} color="rgba(255,255,255,0.6)" />,
  fitbit: <Watch size={18} color="rgba(255,255,255,0.6)" />,
}

const redirectUri = makeRedirectUri({ scheme: 'strengthhub' })

/** One OAuth request per provider, wired to the token exchange + first sync. */
function useProviderAuth(id: ProviderId, onConnected: (id: ProviderId) => void) {
  const endpoint = OAUTH_ENDPOINTS[id]
  const config: AuthRequestConfig = {
    clientId: OAUTH_CLIENT_IDS[id] ?? 'unset',
    scopes: endpoint?.scopes ?? [],
    redirectUri,
    responseType: 'code',
  }
  const [, response, promptAsync] = useAuthRequest(config, endpoint ? { authorizationEndpoint: endpoint.auth } : null)
  const { dispatch } = useStore()
  const toast = useToast()

  useEffect(() => {
    if (response?.type !== 'success') return
    const code = response.params.code
    if (!code) return
    exchangeToken(id, { code, redirectUri })
      .then((tokens) => {
        dispatch({ type: 'SET_INTEGRATION', id, patch: { connected: true, ...tokens } })
        toast(`${id === 'strava' ? 'Strava' : 'Whoop'} connected`)
        onConnected(id)
      })
      .catch(() => toast('Connection failed — try again'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response])

  return promptAsync
}

/**
 * Renders nothing; syncs connected platforms once per app session on launch,
 * so data "pulls through by itself" — the Sync now buttons cover the rest.
 */
export function IntegrationsAutoSync() {
  const { state, dispatch } = useStore()
  const ran = useRef(false)
  useEffect(() => {
    if (ran.current) return
    const any = Object.values(state.integrations ?? {}).some((i) => i.connected)
    if (!any) return
    ran.current = true
    syncAll(state, dispatch).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.integrations])
  return null
}

/**
 * "Connected apps" section: connect Strava/Whoop via OAuth, see native-app
 * providers' status, and pull the latest data with Sync now. Synced runs,
 * rides and sleep flow into Workout history and the habit tracker.
 */
export function IntegrationsSection() {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const [syncing, setSyncing] = useState(false)
  const integ = state.integrations ?? {}
  const anyConnected = Object.values(integ).some((i) => i.connected)

  async function runSync() {
    if (syncing) return
    setSyncing(true)
    try {
      toast(await syncAll(state, dispatch))
    } finally {
      setSyncing(false)
    }
  }

  const promptStrava = useProviderAuth('strava', runSync)
  const promptWhoop = useProviderAuth('whoop', runSync)

  function onPress(p: Provider) {
    const st = integ[p.id]
    if (st?.connected) {
      dispatch({ type: 'SET_INTEGRATION', id: p.id, patch: { connected: false, accessToken: undefined, refreshToken: undefined } })
      toast(`${p.name} disconnected`)
      return
    }
    const avail = providerAvailable(p)
    if (!avail.ok) {
      toast(avail.why ?? `${p.name} is not available yet`)
      return
    }
    if (p.id === 'strava') promptStrava()
    else if (p.id === 'whoop') promptWhoop()
  }

  return (
    <View className="gap-2.5">
      {PROVIDERS.map((p) => {
        const st = integ[p.id]
        const on = !!st?.connected
        const sync = lastSyncLabel(st)
        return (
          <View key={p.id} className="flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-4">
            <View className="h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5">{ICONS[p.id]}</View>
            <View className="flex-1">
              <Text className="font-bold leading-tight text-white">{p.name}</Text>
              <Text className="text-[12px] text-white/50">{on && sync ? sync : p.sub}</Text>
            </View>
            <Pressable
              onPress={() => onPress(p)}
              className={`rounded-full px-3.5 py-1.5 active:opacity-90 ${on ? 'bg-ink-700' : 'bg-brand-400'}`}
            >
              <Text className={`text-sm font-bold ${on ? 'text-brand-400' : 'text-black'}`}>{on ? 'Connected' : 'Connect'}</Text>
            </Pressable>
          </View>
        )
      })}

      {anyConnected && (
        <Pressable
          onPress={runSync}
          disabled={syncing}
          className={`mt-1 w-full flex-row items-center justify-center gap-2 rounded-2xl border border-brand-400/25 bg-brand-400/10 py-3 active:opacity-90 ${syncing ? 'opacity-60' : ''}`}
        >
          {syncing ? <ActivityIndicator size="small" color={brand[400]} /> : <RefreshCw size={15} color={brand[400]} />}
          <Text className="text-sm font-semibold text-brand-400">{syncing ? 'Syncing…' : 'Sync now'}</Text>
        </Pressable>
      )}
      <Text className="mt-0.5 px-1 text-[11px] leading-snug text-white/35">
        Connected apps sync automatically when you open StrengthHub. Runs, rides and swims land in Workout history; steps and sleep feed your habit tracking.
      </Text>
    </View>
  )
}
