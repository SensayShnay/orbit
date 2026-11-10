#!/bin/bash
# Removes Orbit Message sync from this Mac.
PL="$HOME/Library/LaunchAgents/com.orbit.messagesync.plist"
launchctl bootout "gui/$(id -u)" "$PL" 2>/dev/null || launchctl unload "$PL" 2>/dev/null
rm -f "$PL"
rm -rf "$HOME/Applications/Orbit Message Sync.app" "$HOME/Library/Application Support/Orbit Message Sync"
echo "Orbit Message sync is removed from this Mac."
echo "You can also remove it from System Settings > Privacy & Security > Full Disk Access (select it and click -)."
