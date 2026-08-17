/**
 * LOCAL live-coach chat harness (dev only). Drives the REAL runCoachTurn — the exact production
 * orchestration (safety router + classifier + the shipped prompt + structured Gemini reply + action
 * proposals) — against the SEEDED emulator user, and serves a small chat page.
 *
 * Not production, not the deployed callable, flips no launch gate: it enables the coach IN THIS PROCESS
 * only (COACH_RELEASE_CHANNEL=internal) and reads the emulator Firestore. Rate limits are no-oped for
 * testing; everything else (safety, personalisation, proposals) is the real code.
 *
 *   Firestore emulator must be running + user seeded (functions/seed-coach-demo.mjs coach-demo-user).
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=strengthhub-2ab33 GEMINI_API_KEY=... \
 *     node functions/coach-live-harness.cjs
 */
process.env.COACH_RELEASE_CHANNEL = 'internal' // enable the coach IN THIS PROCESS only (import-time gate)
const http = require('http')
const { initializeApp } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const { GoogleGenerativeAI } = require('@google/generative-ai')

const KEY = process.env.GEMINI_API_KEY
if (!KEY) { console.error('need GEMINI_API_KEY'); process.exit(1) }
if (!process.env.FIRESTORE_EMULATOR_HOST) { console.error('need FIRESTORE_EMULATOR_HOST (refusing to touch real Firestore)'); process.exit(1) }
const UID = process.env.DEMO_UID || 'coach-demo-user'
const PORT = Number(process.env.PORT || 8215)

initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'strengthhub-2ab33' })
const { runCoachTurn } = require('./lib/coach.js')
const { loadCoachTurnData, saveCoachTurn, saveSafetySession, saveMemoryCandidate, saveProposal } = require('./lib/coachWorkspace.js')
const { coachKillSwitch, coachActionsSwitch } = require('./lib/killSwitchRemote.js')
const { STRUCTURED_COACH_RESPONSE_SCHEMA } = require('./lib/_shared/backend/coach/structuredResponse.js')

const genAI = new GoogleGenerativeAI(KEY)
const MODEL = 'gemini-2.5-flash-lite'

const classify = async (prompt) => {
  const m = genAI.getGenerativeModel({ model: MODEL })
  const r = await m.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json', maxOutputTokens: 200, thinkingConfig: { thinkingBudget: 0 } },
  })
  return r.response.text() ?? ''
}
const generateReply = async (systemPrompt, userText) => {
  const m = genAI.getGenerativeModel({ model: MODEL, systemInstruction: systemPrompt })
  const r = await m.generateContent({
    contents: [{ role: 'user', parts: [{ text: userText }] }],
    generationConfig: { temperature: 0.5, maxOutputTokens: 600, responseMimeType: 'application/json', responseSchema: STRUCTURED_COACH_RESPONSE_SCHEMA, thinkingConfig: { thinkingBudget: 0 } },
  })
  return (r.response.text() ?? '').trim()
}
const readDob = async (uid) => {
  try { const s = await getFirestore().doc('users/' + uid).get(); return s.data()?.backendUser?.date_of_birth ?? null } catch { return null }
}
const deps = () => ({
  readDob,
  classify,
  generateReply,
  enforceLimit: async () => {}, // no-op for local testing
  killSwitchEngaged: () => coachKillSwitch.engaged(),
  actionsDisabledFresh: () => coachActionsSwitch.engagedFresh(true),
  todayKey: '2026-08-14',
  loadTurnData: loadCoachTurnData,
  saveTurn: saveCoachTurn,
  persistSafety: saveSafetySession,
  saveMemory: saveMemoryCandidate,
  saveProposal,
})

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>StrengthHub Coach — live (local)</title><style>
:root{color-scheme:light dark}body{font:16px/1.5 system-ui,sans-serif;margin:0;background:#0f1115;color:#e7e9ee}
header{padding:12px 16px;background:#1a1d24;border-bottom:1px solid #2a2f3a;font-weight:600}
header small{font-weight:400;color:#8b93a7}
#log{max-width:760px;margin:0 auto;padding:16px;display:flex;flex-direction:column;gap:10px}
.msg{padding:10px 14px;border-radius:14px;max-width:80%;white-space:pre-wrap}
.you{align-self:flex-end;background:#2b6cb0;color:#fff;border-bottom-right-radius:4px}
.coach{align-self:flex-start;background:#1e232c;border:1px solid #2a2f3a;border-bottom-left-radius:4px}
.meta{font-size:12px;color:#8b93a7;margin-top:4px}
.prop{margin-top:8px;padding:8px 10px;border:1px dashed #4a90d9;border-radius:10px;background:#14202e}
.prop b{color:#7fb3ee}
.btns a{display:inline-block;margin:4px 6px 0 0;padding:5px 10px;background:#c0392b;color:#fff;border-radius:8px;text-decoration:none;font-size:13px}
form{position:sticky;bottom:0;max-width:760px;margin:0 auto;display:flex;gap:8px;padding:12px 16px;background:#0f1115}
input{flex:1;padding:11px 14px;border-radius:12px;border:1px solid #2a2f3a;background:#171a21;color:#e7e9ee;font-size:16px}
button{padding:11px 18px;border:0;border-radius:12px;background:#2b6cb0;color:#fff;font-weight:600;font-size:16px;cursor:pointer}
button:disabled{opacity:.5}
</style></head><body>
<header>StrengthHub Coach — <small>LIVE (local emulator · seeded "Alex" · real model + safety + actions)</small></header>
<div id="log"></div>
<form id="f"><input id="m" placeholder="Ask the coach…  (e.g. why is my plan like this? swap the bench. I feel really run down.)" autocomplete="off" autofocus><button id="s">Send</button></form>
<script>
const log=document.getElementById('log'),f=document.getElementById('f'),inp=document.getElementById('m'),btn=document.getElementById('s')
function add(cls,text){const d=document.createElement('div');d.className='msg '+cls;d.textContent=text;log.appendChild(d);log.scrollIntoView(false);return d}
function meta(el,t){const m=document.createElement('div');m.className='meta';m.textContent=t;el.appendChild(m)}
f.onsubmit=async e=>{e.preventDefault();const msg=inp.value.trim();if(!msg)return;add('you',msg);inp.value='';btn.disabled=true
 const thinking=add('coach','…')
 try{const r=await fetch('/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:msg,allowActions:true})});const j=await r.json()
  thinking.textContent=j.error?('[error] '+j.error):(j.text||'(no reply)')
  const bits=[];if(j.mode)bits.push('mode: '+j.mode);if(j.blocked)bits.push('SAFETY BLOCK');if(j.citations&&j.citations.length)bits.push(j.citations.length+' citation(s)')
  if(bits.length)meta(thinking,bits.join(' · '))
  if(j.buttons&&j.buttons.length){const b=document.createElement('div');b.className='btns';j.buttons.forEach(x=>{const a=document.createElement('a');a.textContent=x.label||x.value;a.href='#';b.appendChild(a)});thinking.appendChild(b)}
  if(j.proposal){const p=document.createElement('div');p.className='prop';p.innerHTML='<b>Proposed action</b> ('+(j.proposal.kind||'')+'): '+((j.proposal.title||'')+' — '+(j.proposal.summary||''));thinking.appendChild(p)}
 }catch(err){thinking.textContent='[network error] '+err}
 btn.disabled=false;inp.focus()}
</script></body></html>`

async function main() {
  await coachKillSwitch.refresh().catch(() => {})
  await coachActionsSwitch.refresh().catch(() => {})
  const server = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(PAGE); return }
    if (req.method === 'POST' && req.url === '/chat') {
      let body = ''
      for await (const c of req) body += c
      let message = '', allowActions = true
      try { const j = JSON.parse(body); message = String(j.message || ''); allowActions = j.allowActions !== false } catch {}
      try {
        const result = await runCoachTurn(UID, { message, allowActions }, deps())
        res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(result))
      } catch (e) {
        res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: e?.message || String(e), blocked: true }))
      }
      return
    }
    res.writeHead(404); res.end('not found')
  })
  server.listen(PORT, () => console.log('coach live harness → http://localhost:' + PORT + '  (uid=' + UID + ')'))
}
main()
