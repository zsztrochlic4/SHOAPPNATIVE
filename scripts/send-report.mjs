/**
 * Email the validation summary via SendGrid.
 *
 *   node scripts/send-report.mjs [results/validation-YYYY-MM-DD.json]
 *
 * Reads the aggregated report (argument, or the newest results/validation-*.json) and sends a pass/fail
 * summary with the key metrics. Best-effort: a missing SENDGRID_API_KEY (or send failure) prints a
 * warning and exits 0 — a broken email must never hide the validation result (the artifact + the gate
 * step carry that). Uses Node's built-in fetch (no dependency).
 *
 * Env: SENDGRID_API_KEY, REPORT_TO (comma-separated), REPORT_FROM (a verified SendGrid sender).
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { ROOT } from './lib/result.mjs'

const RESULTS_DIR = resolve(ROOT, 'results')

function newestReport() {
  if (!existsSync(RESULTS_DIR)) return null
  const files = readdirSync(RESULTS_DIR)
    .filter((f) => /^validation-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
  return files.length ? resolve(RESULTS_DIR, files[files.length - 1]) : null
}

function metricLine(sections) {
  const out = []
  const h = sections.holdouts?.metrics
  if (h)
    out.push(
      `Safety holdouts: FP rate ${(100 * (h.false_positive_rate ?? 0)).toFixed(1)}% (${h.false_positives}/${h.benign_controls}), critical misses ${h.critical_misses}/${h.critical_cases}`,
    )
  const d = sections.data_sync?.metrics
  if (d)
    out.push(
      `Datasets: ${Object.entries(d)
        .map(([k, v]) => `${k}=${v.count}${v.ok ? '' : '⚠'}`)
        .join(', ')}`,
    )
  if (sections.firestore) out.push(`Firestore: ${sections.firestore.summary}`)
  if (sections.tests) out.push(`Tests: ${sections.tests.summary}`)
  if (sections.lint) out.push(`Lint: ${sections.lint.summary}`)
  return out
}

function render(report) {
  const badge = report.overall === 'pass' ? '✅ PASS' : '❌ FAIL'
  const lines = metricLine(report.sections)
  const rows = report.parts
    .map((p) => {
      const icon = p.status === 'pass' ? '✅' : p.status === 'skip' ? '⏭️' : '❌'
      return `<tr><td>${icon} ${p.name}</td><td>${p.status}</td><td>${p.critical ? 'yes' : 'no'}</td><td>${escapeHtml(p.summary)}</td></tr>`
    })
    .join('')
  const html = `<div style="font-family:system-ui,Arial,sans-serif">
    <h2>SHO backend validation — ${badge}</h2>
    <p><b>Date:</b> ${report.date} &nbsp; <b>Overall:</b> ${report.overall.toUpperCase()}<br>
    <b>Checks:</b> ${report.summary.passed} pass · ${report.summary.failed} fail · ${report.summary.skipped} skip</p>
    <ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>
    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse">
      <tr><th>Check</th><th>Status</th><th>Critical</th><th>Summary</th></tr>${rows}
    </table>
    ${report.git.run_url ? `<p><a href="${report.git.run_url}">View workflow run</a></p>` : ''}
  </div>`
  const text = [
    `SHO backend validation — ${badge}`,
    `Date: ${report.date}`,
    `Overall: ${report.overall.toUpperCase()}`,
    `Checks: ${report.summary.passed} pass / ${report.summary.failed} fail / ${report.summary.skipped} skip`,
    '',
    ...lines,
    '',
    report.git.run_url ?? '',
  ].join('\n')
  return { html, text, badge }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
}

async function main() {
  const file = process.argv[2] || newestReport()
  if (!file || !existsSync(file)) {
    console.warn(`send-report: no report file found (${file ?? 'none'}) — skipping email`)
    return
  }
  const report = JSON.parse(readFileSync(file, 'utf8'))

  const key = process.env.SENDGRID_API_KEY
  const to = (process.env.REPORT_TO ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const from = process.env.REPORT_FROM
  if (!key || !to.length || !from) {
    console.warn(
      'send-report: SENDGRID_API_KEY / REPORT_TO / REPORT_FROM not all set — skipping email (report artifact still uploaded)',
    )
    return
  }

  const { html, text, badge } = render(report)
  const body = {
    personalizations: [{ to: to.map((email) => ({ email })) }],
    from: { email: from, name: 'SHO Backend Validation' },
    subject: `[SHO] Backend validation ${badge} — ${report.date}`,
    content: [
      { type: 'text/plain', value: text },
      { type: 'text/html', value: html },
    ],
  }

  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.status >= 200 && res.status < 300) {
      console.log(`send-report: emailed ${to.join(', ')} (${badge})`)
    } else {
      const t = await res.text().catch(() => '')
      console.warn(`send-report: SendGrid returned ${res.status}: ${t.slice(0, 300)} — continuing`)
    }
  } catch (e) {
    console.warn(`send-report: send failed (${e.message}) — continuing`)
  }
}

main()
