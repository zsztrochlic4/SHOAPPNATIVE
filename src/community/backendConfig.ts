/**
 * Master switch for the live Firestore community backend, kept in its own tiny
 * module with NO firebase import. That lets the client check the flag cheaply and
 * only pull the (heavy) firebase adapter — src/community/backend.ts — via a
 * dynamic import() when it's actually on. With the flag off, the community bundle
 * never loads the firebase SDK.
 *
 * Keep false until the backend is deployed + emulator-tested. Flip to true to
 * route username claims and the league board through Firestore.
 */
export const COMMUNITY_BACKEND: boolean = false
