#!/bin/bash
# Orbit Message sync installer for macOS. Run with the command from Orbit > Settings > Message sync.
TOKEN="${1:-}"
BASE="https://mpjqxzsdjwmsfmselztl.supabase.co/functions/v1/orbit-sync"
DIR="$HOME/Library/Application Support/Orbit Message Sync"
APP="$HOME/Applications/Orbit Message Sync.app"
PL="$HOME/Library/LaunchAgents/com.orbit.messagesync.plist"
b=$(tput bold 2>/dev/null); n=$(tput sgr0 2>/dev/null)
say() { printf '%s\n' "$*"; }
if [ -z "$TOKEN" ] || [ "${TOKEN#orb_}" = "$TOKEN" ]; then say "Copy the full command from Orbit > Settings > Message sync, then paste it here."; exit 1; fi
say ""; say "${b}Setting up Orbit Message sync${n}"
say "It reads only who you messaged and when. Never what the messages say."; say ""

mkdir -p "$DIR" "$HOME/Applications" "$HOME/Library/LaunchAgents" || exit 1
( umask 077; printf '%s' "$TOKEN" > "$DIR/token" )
if ! /usr/bin/curl -fsSL "$BASE?get=sync" -o "$DIR/sync.sh"; then say "Couldn't download the sync script. Check your internet and try again."; exit 1; fi
chmod 700 "$DIR/sync.sh"

# A tiny local app, so macOS can give it (and only it) permission to read Messages.
rm -rf "$APP"
/usr/bin/osacompile -o "$APP" \
  -e 'set d to POSIX path of (path to home folder) & "Library/Application Support/Orbit Message Sync/"' \
  -e 'do shell script "/bin/bash " & quoted form of (d & "sync.sh") & " >> " & quoted form of (d & "sync.log") & " 2>&1; true"' || { say "Couldn't create the helper app."; exit 1; }
/usr/libexec/PlistBuddy -c "Add :LSUIElement bool true" "$APP/Contents/Info.plist" 2>/dev/null
/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier com.orbit.messagesync" "$APP/Contents/Info.plist" 2>/dev/null || /usr/libexec/PlistBuddy -c "Add :CFBundleIdentifier string com.orbit.messagesync" "$APP/Contents/Info.plist"
/usr/bin/codesign --force --sign - "$APP" >/dev/null 2>&1

# Run it twice a day (10:15 and 20:15), quietly in the background.
cat > "$PL" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.orbit.messagesync</string>
  <key>ProgramArguments</key><array><string>/usr/bin/open</string><string>-g</string><string>-j</string><string>-a</string><string>$APP</string></array>
  <key>StartCalendarInterval</key><array>
    <dict><key>Hour</key><integer>10</integer><key>Minute</key><integer>15</integer></dict>
    <dict><key>Hour</key><integer>20</integer><key>Minute</key><integer>15</integer></dict>
  </array>
</dict></plist>
EOF
launchctl bootout "gui/$(id -u)" "$PL" 2>/dev/null
launchctl bootstrap "gui/$(id -u)" "$PL" 2>/dev/null || launchctl load "$PL" 2>/dev/null

say "${b}One last step: give it permission to read Messages.${n}"
say "  1. A Settings window is opening on ${b}Full Disk Access${n}, and a Finder window is showing ${b}Orbit Message Sync${n}."
say "  2. Drag ${b}Orbit Message Sync${n} from Finder into the Full Disk Access list"
say "     (or click ${b}+${n}, go to your home folder > Applications, and pick it)."
say "  3. Make sure its switch is ${b}on${n}."
sleep 1
open "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles"
open -R "$APP"
say ""
for try in 1 2 3; do
  printf 'Press Enter when the switch is on... '; read -r _ < /dev/tty
  say "Syncing now..."
  open -W -g -j -a "$APP"
  last="$(tail -n 1 "$DIR/sync.log" 2>/dev/null)"
  case "$last" in
    *Synced*) say ""; say "${b}All set.${n} Synced ${last##*Synced }"; say "Orbit will now update on its own twice a day. Check Orbit > Settings > Message sync to see it."; exit 0;;
    *"No access"*) say "It still can't read Messages. Check that Orbit Message Sync is in the list and switched on.";;
    *) say "Something went wrong: $last"; break;;
  esac
done
say "You can finish later. It will keep trying twice a day, and Orbit > Settings shows whether it's working."
