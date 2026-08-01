/**
 * Turn Firebase Auth error codes into friendly, human sentences. Shared by the
 * standalone AuthScreen and the onboarding's inline sign-up / log-in steps so
 * the wording stays identical everywhere.
 */
export function friendlyError(code: string): string {
  switch (code) {
    case 'auth/invalid-email': return 'That email address doesn’t look right.'
    case 'auth/missing-password': return 'Please enter a password.'
    case 'auth/weak-password': return 'Password should be at least 6 characters.'
    case 'auth/email-already-in-use': return 'An account with this email already exists — try logging in.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found': return 'Wrong email or password.'
    case 'auth/too-many-requests': return 'Too many attempts. Please wait a moment and try again.'
    case 'auth/network-request-failed': return 'Network error. Check your connection and try again.'
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request': return 'Sign-in was cancelled.'
    // Email/Password sign-in isn't switched on for this Firebase project.
    case 'auth/operation-not-allowed':
      return 'Email sign-up isn’t enabled yet. Turn on Email/Password in Firebase → Authentication → Sign-in method.'
    case 'auth/admin-restricted-operation':
      return 'Sign-ups are currently restricted for this project. Enable Email/Password sign-in in the Firebase console.'
    case 'auth/configuration-not-found':
      return 'Authentication isn’t set up for this project yet. Enable a sign-in method in the Firebase console.'
    // Key is valid for other services but blocked for Auth — Identity Toolkit
    // API disabled, or the key’s API restrictions exclude it.
    case 'auth/api-key-not-valid':
    case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
    case 'auth/invalid-api-key':
      return 'Sign-in is blocked: enable the “Identity Toolkit API” for this project in Google Cloud, or remove the API-key restriction that’s excluding it.'
    // Surface the raw code so an unexpected failure is diagnosable, not a mystery.
    default: return code ? `Couldn’t complete that (${code}). Please try again.` : 'Something went wrong. Please try again.'
  }
}
