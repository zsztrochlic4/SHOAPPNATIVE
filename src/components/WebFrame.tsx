import type { ReactNode } from 'react'
import { Modal, View, Text, Platform, type ViewStyle, type TextStyle } from 'react-native'
import { Wifi, BatteryFull, SignalHigh } from 'lucide-react-native'

export const IS_WEB = Platform.OS === 'web'

/**
 * The web preview renders the app inside a centered phone mockup. These are the
 * canonical device dimensions — the app frame AND every overlay (menu, sheets,
 * full-screen modals) share them so overlays stay perfectly aligned with the
 * phone instead of stretching across the whole browser window.
 */
export const DEVICE = {
  width: 402,
  height: 874,
  radius: 48,
  border: 12,
  borderColor: '#0d0d0f',
  bg: '#000',
} as const

/** Usable screen inside the device border (what content actually fills). */
export const WEB_SCREEN = {
  width: DEVICE.width - DEVICE.border * 2,
  height: DEVICE.height - DEVICE.border * 2,
} as const

/** The iOS-style status bar the mockup expects: time on the left, radios right. */
export function FauxStatusBar() {
  return (
    <View style={frameStyles.statusBar}>
      <Text style={frameStyles.statusTime}>9:41</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <SignalHigh size={18} color="#fff" strokeWidth={2.5} />
        <Wifi size={17} color="#fff" strokeWidth={2.5} />
        <BatteryFull size={24} color="#fff" strokeWidth={2} />
      </View>
    </View>
  )
}

/**
 * On the web preview, present the app inside a centered phone mockup so it reads
 * as the mobile app it is, instead of stretching across the whole browser. On
 * native this is a no-op — the app fills the device as usual.
 */
export function WebPreviewFrame({ children }: { children: ReactNode }) {
  if (!IS_WEB) return <>{children}</>
  return (
    <View style={frameStyles.page}>
      <View style={frameStyles.device}>
        <FauxStatusBar />
        <View style={{ flex: 1 }}>{children}</View>
      </View>
    </View>
  )
}

type AppModalProps = {
  visible: boolean
  onRequestClose?: () => void
  animationType?: 'none' | 'slide' | 'fade'
  /** Transparent overlays (bottom sheets, centered dialogs) draw their own dim
   *  backdrop; opaque overlays (menu, full-screen views) get the device chrome. */
  transparent?: boolean
  children: ReactNode
}

/**
 * Drop-in replacement for RN `Modal`. On native it renders a plain `Modal`. On
 * web, RN Web portals modals to <body>, which escapes the phone mockup — so we
 * re-center the content inside the same device geometry as `WebPreviewFrame`,
 * keeping overlays aligned with the app instead of filling the browser window.
 */
export function AppModal({ visible, onRequestClose, animationType = 'slide', transparent = false, children }: AppModalProps) {
  if (!IS_WEB) {
    return (
      <Modal visible={visible} transparent={transparent} animationType={animationType} onRequestClose={onRequestClose} statusBarTranslucent>
        {children}
      </Modal>
    )
  }

  // Web: always render transparent so the surrounding "desk" (the real
  // WebPreviewFrame directly behind, at the identical position) shows through.
  return (
    <Modal visible={visible} transparent animationType={animationType} onRequestClose={onRequestClose}>
      <View style={frameStyles.page} pointerEvents="box-none">
        {transparent ? (
          // Clip the overlay's own dim/card to the rounded screen rectangle.
          <View style={frameStyles.screenClip}>{children}</View>
        ) : (
          // Opaque overlays reproduce the full device chrome + status bar.
          <View style={frameStyles.device}>
            <FauxStatusBar />
            <View style={{ flex: 1 }}>{children}</View>
          </View>
        )}
      </View>
    </Modal>
  )
}

const frameStyles: {
  page: ViewStyle
  device: ViewStyle
  screenClip: ViewStyle
  statusBar: ViewStyle
  statusTime: TextStyle
} = {
  page: {
    flex: 1,
    minHeight: '100%',
    backgroundColor: '#0a0a0b',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  device: {
    width: DEVICE.width,
    height: DEVICE.height,
    maxWidth: '100%',
    maxHeight: '100%',
    borderRadius: DEVICE.radius,
    overflow: 'hidden',
    backgroundColor: DEVICE.bg,
    borderWidth: DEVICE.border,
    borderColor: DEVICE.borderColor,
    // react-native-web maps these shadow props to a CSS box-shadow.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 40 },
    shadowOpacity: 0.55,
    shadowRadius: 80,
  },
  // Same footprint as the device, but the border is transparent so the overlay's
  // own content (and its dim backdrop) fills the screen area and clips to the
  // rounded corners without hiding the real phone chrome behind it.
  screenClip: {
    width: DEVICE.width,
    height: DEVICE.height,
    maxWidth: '100%',
    maxHeight: '100%',
    borderRadius: DEVICE.radius,
    borderWidth: DEVICE.border,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  statusBar: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    backgroundColor: '#000',
  },
  statusTime: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
}
