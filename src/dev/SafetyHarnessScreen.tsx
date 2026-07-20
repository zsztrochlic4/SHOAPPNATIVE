/**
 * DEV-ONLY screen that runs the holdout validation through the real production Gemini path and
 * shows the report. Rendered ONLY behind the `__DEV__` guard in App.tsx (see that file) and never
 * imported by production code, so it is excluded from release/App-Store bundles.
 *
 * It measures the classifier; it does not enable the coach (no `askCoach` call, gate untouched).
 */

import { useState } from 'react'
import { View, Text, Pressable, ScrollView, ActivityIndicator, Platform } from 'react-native'
import { hasClassifierTransport } from '../backend/coach/safety'
import { runHoldout, buildReport, BUILD_UNDER_TEST, type HoldoutResult } from './coachSafetyHarness'

export function SafetyHarnessScreen() {
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [report, setReport] = useState<string | null>(null)
  const modelWired = hasClassifierTransport()

  async function run() {
    setRunning(true)
    setReport(null)
    try {
      const results: HoldoutResult[] = await runHoldout((done, total) => setProgress({ done, total }))
      const text = buildReport(results)
      setReport(text)
      // Also emit to the Metro/dev console so it is captured in the terminal logs.
      console.log('\n' + text + '\n')
    } catch (e) {
      setReport(`Harness error: ${(e as Error)?.message ?? e}`)
    } finally {
      setRunning(false)
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0B', paddingTop: 54, paddingHorizontal: 14 }}>
      <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>Safety Holdout Validation (DEV)</Text>
      <Text style={{ color: '#9aa', fontSize: 12, marginTop: 4 }}>
        {BUILD_UNDER_TEST.model.model} · temp {BUILD_UNDER_TEST.model.temperature} · classifier {BUILD_UNDER_TEST.classifierVersion}
      </Text>

      {!modelWired && (
        <View style={{ backgroundColor: '#3a1d1d', borderRadius: 8, padding: 10, marginTop: 10 }}>
          <Text style={{ color: '#ffb4a8', fontSize: 12 }}>
            No model transport is wired. Firebase is not configured (likely EXPO_PUBLIC_DEMO_MODE=1),
            so the classifier will report UNAVAILABLE and every case FAILS SAFE — this measures the
            fail-safe, NOT Gemini. Run WITHOUT demo mode, on a build with your Firebase config + App
            Check, to get production-faithful numbers.
          </Text>
        </View>
      )}

      <Pressable
        onPress={run}
        disabled={running}
        style={{ backgroundColor: running ? '#333' : '#2f6fed', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 12 }}
      >
        <Text style={{ color: '#fff', fontWeight: '700' }}>
          {running ? `Running… ${progress.done}/${progress.total}` : 'Run holdout validation'}
        </Text>
      </Pressable>
      {running && <ActivityIndicator color="#2f6fed" style={{ marginTop: 12 }} />}

      {report != null && (
        <ScrollView style={{ flex: 1, marginTop: 12 }} contentContainerStyle={{ paddingBottom: 60 }} horizontal={false}>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <Text
              selectable
              style={{ color: '#d6f5d6', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 11 }}
            >
              {report}
            </Text>
          </ScrollView>
        </ScrollView>
      )}
    </View>
  )
}
