/**
 * Shared, asset-free UI sound cues built on the Web Audio API — the rest-end
 * beep, the last-few-seconds rest tick, and the workout-complete chime that
 * make the guided flow feel as considered as Whoop / Apple Fitness.
 *
 * These run on web (where AudioContext exists); on native there is no bundled
 * audio engine, so every helper is a safe no-op. Nothing here ever throws.
 *
 * All cues respect a single user setting: call `setSoundEnabled(false)` (wired
 * to Settings → "Sounds & cues") and every helper below goes quiet. Haptics are
 * a separate channel and unaffected.
 */

let soundOn = true

/** Wire the Settings toggle to the sound engine. Synced from the store in App. */
export function setSoundEnabled(on: boolean) {
  soundOn = on
}

/** Whether cues are currently enabled (used to avoid redundant vibration too). */
export function soundEnabled() {
  return soundOn
}

type AnyWin = { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }

function audioCtx(): AudioContext | null {
  if (!soundOn) return null
  try {
    const w = typeof window !== 'undefined' ? (window as unknown as AnyWin) : undefined
    const Ctx = w?.AudioContext || w?.webkitAudioContext
    if (!Ctx) return null
    return new Ctx()
  } catch {
    return null
  }
}

/** One short sine blip. Shared by the rest-end beep and the countdown tick. */
function blip(freq: number, peak: number, dur: number) {
  const ctx = audioCtx()
  if (!ctx) return
  try {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(peak, ctx.currentTime + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + dur + 0.01)
    osc.onended = () => ctx.close()
  } catch {
    /* Audio not available — silently ignore. */
  }
}

/** Rest-over alert — a clear, confident note. */
export function beep() {
  blip(880, 0.18, 0.15)
}

/** Quiet high tick for the final seconds of a rest countdown (3…2…1). */
export function restTick() {
  blip(1320, 0.1, 0.06)
}

/** A short rising three-note chime for the workout-complete moment. */
export function successChime() {
  const ctx = audioCtx()
  if (!ctx) return
  try {
    ;[660, 880, 1175].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const t0 = ctx.currentTime + i * 0.12
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, t0)
      gain.gain.exponentialRampToValueAtTime(0.2, t0 + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t0)
      osc.stop(t0 + 0.24)
    })
    setTimeout(() => ctx.close(), 700)
  } catch {
    /* Audio not available — silently ignore. */
  }
}
