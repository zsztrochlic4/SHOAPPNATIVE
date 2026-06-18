import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { View, Text } from 'react-native'
import { CheckCircle2 } from 'lucide-react-native'
import { brand } from '../theme'

type Toast = { id: number; msg: string }
const ToastCtx = createContext<(msg: string) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((msg: string) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, msg }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2200)
  }, [])

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <View
        pointerEvents="none"
        className="absolute inset-x-0 z-[60] items-center gap-2 px-6"
        style={{ bottom: 112 }}
      >
        {toasts.map((t) => (
          <View
            key={t.id}
            className="flex-row items-center gap-2 rounded-full border border-white/10 bg-ink-700 px-4 py-2.5"
          >
            <CheckCircle2 size={16} color={brand[400]} />
            <Text className="text-sm font-semibold text-white">{t.msg}</Text>
          </View>
        ))}
      </View>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  return useContext(ToastCtx)
}
