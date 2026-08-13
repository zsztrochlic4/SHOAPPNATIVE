# Dependency risk record — 2026-08-13

## Current result

- Root production audit: **0 critical, 0 moderate, 15 high**.
- Cloud Functions audit: **0 vulnerabilities**.
- `firebase-tools` is pinned to `15.26.0`; CI no longer installs an unreviewed latest CLI.

## Remaining high findings

All 15 root findings collapse to the Expo 57 / React Native 0.86 Metro toolchain and its
`image-size <=2.0.2` parsers. The published automatic remediation is a major downgrade to Expo 53
and React Native 0.72, which is incompatible with the current app and would remove current platform
fixes. These modules process developer/build-time assets; they are not an app API that accepts
untrusted remote user images in the shipped JS bundle. Risk is therefore contained but not erased.

## Controls and owner

- Owner: mobile platform maintainer.
- Do not feed untrusted ICNS/JXL/HEIF assets into Metro or CI.
- Keep dependency audit in the release gate; reject any critical finding.
- Recheck Expo/Metro advisories weekly and on every Expo SDK release.
- Upgrade to the first compatible Expo/React Native release that pulls a fixed `image-size`.
- Review deadline: **2026-09-13**. This exception expires rather than silently becoming permanent.

No `--force` downgrade was applied because that would trade a reachable compatibility/regression
risk for a build-tool advisory without demonstrating an actually safer application.
