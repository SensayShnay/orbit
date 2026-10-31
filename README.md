# Orbit

Your relationship tracker as a real iPhone app. Same Orbit you built in Claude, now backed by your own Supabase project.

## One-time setup

### 1. Database (Supabase)
1. Supabase dashboard → **SQL Editor** → New query.
2. Paste all of `supabase/schema.sql`, click **Run**. You should see "Success".
3. **Authentication → Sign In / Providers → Email**: leave Email on. For just you, turn **Confirm email** off so you can sign in right away.

### 2. AI (drafts, personal reads, spins)
1. **Edge Functions → Deploy a new function → Via editor**, name it `ai`. (If Supabase gives it a random name like `bright-action`, put that name in `src/config.js` as `aiFunction`.)
2. Paste `supabase/functions/ai/index.ts`, deploy.
3. **Edge Functions → Secrets** → add `ANTHROPIC_API_KEY` with your key from console.anthropic.com.

### 3. Build the app (on your Mac)
```
cd orbit
npm install
npx cap add ios
npm run ios
```
Xcode opens. Pick the **App** target → **Signing & Capabilities** → choose your Team (after Apple approves your account). Hit ▶ with your iPhone plugged in to try it.

### 4. Move your data in
Open the app, tap "First time? Create your account", then **More → Settings → About → Restore from backup** and pick `orbit-backup.json`. Contacts, profiles, settings, Wrapped and photos all come over.

### 5. TestFlight
1. App Store Connect → My Apps → **+** → New App (bundle ID `com.sensayshnay.orbit`).
2. In Xcode: set the device to **Any iOS Device**, then **Product → Archive** → **Distribute App** → App Store Connect → Upload.
3. In App Store Connect → TestFlight, add yourself (and friends) as testers.

## Updating
Edit `src/orbit.html` (or drop in a newer export from Claude), then `npm run ios` again.

## How it's put together
- `src/orbit.html` is the app itself, unchanged from the Claude version.
- `src/shim.js` gives it the same storage, AI, photo and download features it had inside Claude, but backed by Supabase.
- `build.mjs` stitches them into `www/index.html`, which Capacitor wraps into the iOS app.
