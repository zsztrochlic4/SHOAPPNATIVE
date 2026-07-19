import { useEffect, useRef, useState, type ReactNode } from 'react'
import { View, Text, Pressable, ActivityIndicator } from 'react-native'
import { HeartPulse, Activity, Watch, RefreshCw } from 'lucide-react-native'
import { useStore } from '../store/store'
import { useToast } from './Toast'
import { PROVIDERS, providerAvailable, syncAll, lastSyncLabel, type Provider, type ProviderId } from '../lib/integrations'
import { brand, accent } from '../theme'

const ICONS: Record<ProviderId, ReactNode> = {
  appleHealth: <HeartPulse size={18} color="#f87171" />,
  healthConnect: <Activity size={18} color={accent.blue} />,
  garmin: <Watch size={18} color="rgba(255,255,255,0.6)" />,
  fitbit: <Watch size={18} color="rgba(255,255,255,0.6)" />,
}

/**
 * Renders nothing; syncs connected platforms once per app session on launch, so data
 * "pulls through by itself". No provider can connect until the native builds ship, so this
 * is currently a no-op.
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
 * "Connected apps" section. Apple Health / Health Connect connect on-device in the native
 * store-release build; until then each shows its status. Synced workouts, steps and sleep
 * flow into Workout history and the habit tracker.
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

  function onPress(p: Provider) {
    const st = integ[p.id]
    if (st?.connected) {
      dispatch({ type: 'SET_INTEGRATION', id: p.id, patch: { connected: false, accessToken: undefined, refreshToken: undefined } })
      toast(`${p.name} disconnected`)
      return
    }
    // Nothing is connectable yet (native builds pending) — explain why.
    const avail = providerAvailable(p)
    toast(avail.why ?? `${p.name} is not available yet`)
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
        Apple Health and Health Connect sync automatically once the native app ships — your workouts, steps and sleep land in Workout history and feed your habit tracking.
      </Text>
    </View>
  )
}
