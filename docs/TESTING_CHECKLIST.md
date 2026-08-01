# Full-testing checklist

Manual/QA items to verify during a full testing pass before release. Check them
off as they pass on a real device / real-Firebase run.

---

## Account creation + Paywall + Stripe  — ⚠️ NOT YET TESTED END-TO-END (added 2026-08-01)

Built and deployed in **test mode** (Stripe Sandbox); the whole path still needs
a real run. Setup + how-to: [STRIPE_SETUP.md](STRIPE_SETUP.md). Run in real mode
with `$env:EXPO_PUBLIC_DEMO_MODE='0'` (don't edit `.env.local`).

**Prerequisites to confirm first**
- [ ] Firebase → Authentication → Sign-in method: **Email/Password enabled** (and **Google** if that button should work)
- [ ] Stripe → Settings → Billing → **Customer portal activated** (powers the "Restore" link)
- [ ] Still in Stripe **test mode**; swap to live keys only for production (see STRIPE_SETUP.md "Going live")

**Sign-up / onboarding**
- [ ] "Get Started" → onboarding → **Create Account** (email+password) creates a real Firebase account
- [ ] **Continue with Google** signup works
- [ ] The name gathered in onboarding becomes the account display name
- [ ] Onboarding data (profile + generated program) persists under the new uid after signup (not wiped by CloudSync)
- [ ] "Continue with Apple" still shows the "coming soon" notice (intentionally not wired)

**Paywall + payment**
- [ ] Paywall appears immediately after signup (real mode) and matches the 3d design
- [ ] "Start my 4-week free trial" opens Stripe Checkout
- [ ] Test card `4242 4242 4242 4242` (any future expiry/CVC/postcode) completes
- [ ] Redirected back → app lands on the **dashboard**
- [ ] Closing/cancelling Checkout returns to the paywall (still gated)

**Entitlement wiring**
- [ ] `entitlements/{uid}` written with `status: "trialing"`, `trialEnd`, `stripeCustomerId`
- [ ] `users/{uid}.profile.premium` mirrored to `true`
- [ ] Relaunch while trialing → straight to dashboard (gate persists across restarts)
- [ ] Cancel the sub in Stripe → webhook flips `status`; app re-gates to the paywall
- [ ] **Restore** link opens the Stripe billing portal

**Modes / platforms**
- [ ] Demo mode (`DEMO_MODE=1`) still skips the paywall → dashboard (preview unaffected)
- [ ] Returning user via **Log In** → dashboard if entitled, paywall if not
- [ ] Native (iOS/Android): Checkout opens in the browser and returns via the `strengthhub://checkout` scheme

**Follow-ups (not blockers)**
- [ ] Wire real **Sign-in with Apple** (needs Apple Developer Program membership)
- [ ] Flip `APP_CHECK_ENFORCED` on the billing callables once the client attests
- [ ] Remove now-dead `src/screens/Welcome.tsx` / `src/auth/AuthScreen.tsx` pre-onboarding wall (superseded by the onboarding front door)
