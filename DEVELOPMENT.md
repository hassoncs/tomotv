# TomoTV Development Setup

## Local Development Configuration

### Quick Start

1. **Copy the environment template:**
   ```bash
   cp .env.example .env.local
   ```

2. **Add your local Jellyfin server credentials to `.env.local`:**
   ```bash
   EXPO_PUBLIC_DEV_JELLYFIN_SERVER=http://YOUR_LOCAL_IP:8096
   EXPO_PUBLIC_DEV_JELLYFIN_API_KEY=your_api_key_here
   EXPO_PUBLIC_DEV_JELLYFIN_USER_ID=your_user_id_here
   ```

3. **Start the development server:**
   ```bash
   npm start
   ```

That's it! The app will automatically use your `.env.local` credentials during development.

---

## How It Works

### Development vs Production

The app uses a **smart fallback system** for Jellyfin server configuration:

#### **During Development (with `.env.local`):**
1. App checks SecureStore for user-configured settings
2. If empty, falls back to `.env.local` credentials
3. You can develop without configuring settings every time ✅

#### **In Production (App Store builds):**
1. `.env.local` is **NOT included** (it's in `.gitignore`)
2. App requires users to configure their own server
3. No hardcoded credentials exposed ✅

### Environment Variables

Variables in `.env.local` must use the `EXPO_PUBLIC_` prefix to be accessible in the app:

```bash
# ✅ Correct - accessible in app
EXPO_PUBLIC_DEV_JELLYFIN_SERVER=http://10.81.1.112:8096

# ❌ Wrong - not accessible
DEV_JELLYFIN_SERVER=http://10.81.1.112:8096
```

---

## Getting Jellyfin Credentials

### 1. Server IP
- Find your Mac's local IP: **System Settings → Network → Wi-Fi → Details**
- Example: `http://192.168.1.100:8096`
- Or use: `http://localhost:8096` if running on same machine

### 2. API Key
1. Open Jellyfin web interface
2. Go to **Dashboard → API Keys**
3. Click **+ New API Key**
4. Name it "TomoTV Development"
5. Copy the generated key

### 3. User ID
1. Open Jellyfin web interface
2. Go to your **user profile** (click avatar in top right)
3. The URL will show your User ID: `http://server:8096/web/index.html#!/users/user?userId=YOUR_USER_ID`
4. Or check **Dashboard → Users → [Your User]** and look in the URL

---

## Testing Production Behavior

To test how the app behaves for end users (without dev credentials):

1. **Temporarily rename `.env.local`:**
   ```bash
   mv .env.local .env.local.backup
   ```

2. **Restart the dev server:**
   ```bash
   npm start
   ```

3. **Expected behavior:**
   - App shows: "Jellyfin server not configured"
   - Tap "Go to Settings" button
   - Configure your server manually
   - Settings persist in iCloud Keychain

4. **Restore dev credentials:**
   ```bash
   mv .env.local.backup .env.local
   ```

---

## Security Notes

### ⚠️ **DO NOT commit `.env.local` to git!**

Your `.env.local` file contains sensitive credentials and is automatically ignored by git.

**What's safe to commit:**
- ✅ `.env.example` - Template with no real credentials
- ✅ `jellyfinApi.ts` - Uses env vars, no hardcoded values
- ✅ `.gitignore` - Excludes `.env*.local`

**Never commit:**
- ❌ `.env.local` - Contains your real credentials
- ❌ Hardcoded IPs, API keys, or User IDs in code

---

## Troubleshooting

### App shows "not configured" even with `.env.local`

**Check:**
1. Variables use `EXPO_PUBLIC_` prefix
2. No quotes around values: `EXPO_PUBLIC_DEV_JELLYFIN_SERVER=http://10.81.1.112:8096` ✅
3. Restart Metro bundler: `npm start -- --clear`

### "Network request timed out" on iOS Simulator

**Solution:** Ensure ATS (App Transport Security) is configured in `app.json`:
```bash
npx expo prebuild --clean
npm run ios
```

See: `app.json` → `ios.infoPlist.NSAppTransportSecurity`

### Can't connect to Jellyfin server

**Check:**
1. Jellyfin server is running
2. IP address is correct (try `http://localhost:8096` if on same machine)
3. Firewall allows port 8096
4. iOS ATS allows HTTP connections (see above)

---

## App Store Submission

Before submitting to App Store, verify:

1. **No hardcoded credentials in source code** ✅
2. **`.env.local` is in `.gitignore`** ✅
3. **Production build doesn't include dev env vars** ✅
4. **First-run experience works** (test without `.env.local`)
5. **Settings screen allows user configuration** ✅

The app is designed to be **safe for App Store distribution** while maintaining an excellent **developer experience**.
