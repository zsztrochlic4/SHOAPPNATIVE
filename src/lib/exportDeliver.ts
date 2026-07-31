/**
 * Platform delivery for a "Download my data" export. Web triggers a real file
 * download (Blob + anchor); native hands the JSON to the OS share sheet via RN's
 * built-in Share (no extra native module, so it works on the current dev build).
 * Pure serialisation lives in src/lib/dataExport.ts.
 */
import { Platform, Share } from 'react-native'

export async function deliverExport(filename: string, json: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof document === 'undefined') return
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return
  }
  await Share.share({ message: json, title: filename })
}
