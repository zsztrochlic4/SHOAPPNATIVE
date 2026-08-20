#!/usr/bin/env bash
# Install the release APK on the already-booted emulator and run the Maestro smoke
# suite. Lives in a file (not inline in the workflow) because the emulator-runner
# action word-splits complex inline `script:` lines, which broke an inline
# `until … done` loop. reactivecircus/android-emulator-runner has already waited
# for the emulator to finish booting before this runs, so no boot-wait is needed —
# but the package/storage services can still lag, throwing
# StorageManagerService.allocateBytes NPE on install, so retry a few times.
set -u

apk="app-release.apk"

installed=0
for n in 1 2 3 4 5; do
  if adb install -r "$apk"; then
    installed=1
    break
  fi
  echo "install attempt $n failed; retrying in 20s…"
  sleep 20
done

if [ "$installed" != "1" ]; then
  echo "ERROR: could not install $apk after 5 attempts"
  exit 1
fi

exec "$HOME/.maestro/bin/maestro" test .maestro --include-tags smoke --format junit --output maestro-report.xml
