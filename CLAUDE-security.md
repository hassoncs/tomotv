# CLAUDE-security.md

**Last Updated:** January 22, 2026
**Security Audit Completed:** January 22, 2026

This document describes the security architecture, known limitations, and mitigations for the TomoTV app.

---

## Security Posture: STRONG ✅

**Overall Assessment:** No critical vulnerabilities identified. The app follows security best practices for a personal media streaming client.

---

## 1. Credential Storage

### Native Secure Storage

**Platform Implementation:**
- **iOS/tvOS:** iCloud Keychain (AES-256 encrypted)
- **Android:** Android Keystore (hardware-backed when available)
- **Library:** `expo-secure-store` (official Expo module)

**Stored Credentials:**
| Key | Type | Purpose |
|-----|------|---------|
| `jellyfin_server_url` | String | Full Jellyfin server URL |
| `jellyfin_api_key` | String (hex) | API authentication token |
| `jellyfin_user_id` | String (hex/GUID) | User identifier |
| `app_video_quality` | String (0-3) | Transcoding quality preset |
| `jellyfin_is_demo_mode` | String ("true"/null) | Demo server flag |

**Security Features:**
- ✅ Automatic encryption at rest
- ✅ Keychain syncs across user devices (iOS)
- ✅ Cannot be accessed by other apps
- ✅ Cleared on app uninstall
- ✅ Protected by device PIN/biometrics

### No Hardcoded Secrets

**Verified:**
- ✅ Zero hardcoded credentials in source code
- ✅ `.env.local` is git-ignored (development only)
- ✅ Production builds require user configuration via Settings
- ✅ Demo server credentials fetched dynamically from API

---

## 2. Network Security

### Transport Layer Security

**HTTPS Enforcement:**
- ✅ HTTPS **required** for remote/internet Jellyfin servers
- ✅ HTTP **allowed** for local network only (192.168.x.x, 10.x.x.x, etc.)
- ✅ Configured via `NSAppTransportSecurity` in app.json

**App Transport Security (iOS/tvOS):**
```json
"NSAppTransportSecurity": {
  "NSAllowsLocalNetworking": true
}
```

**What This Means:**
- Internet servers: Must use HTTPS (enforced by iOS)
- Local network: HTTP allowed (common for home Jellyfin servers)
- No certificate pinning (users may have self-signed certs)

### Request Timeouts

**Timeout Enforcement:**
- Quick queries: 10 seconds
- Normal requests: 15 seconds
- Large data fetches: 30 seconds
- All requests use `AbortController` for proper cancellation

**Protection Against:**
- Hanging connections
- Slow loris attacks (indirect)
- Resource exhaustion from stalled requests

---

## 3. API Key Exposure (Known Limitation)

### Issue Description

**What Happens:**
API keys appear in URLs for certain requests:
- Image URLs: `https://server/Items/{id}/Images/Primary?api_key={key}`
- Video streams: `https://server/Videos/{id}/stream?api_key={key}`
- Subtitles: `https://server/Videos/{id}/Subtitles/{index}?api_key={key}`

**Where Keys Are Visible:**
- Development console logs (URL previews)
- Server access logs
- Browser history (web platform)
- Network capture tools during debugging

### Why This Happens

**Technical Constraint:**
Native components (`<Image>`, `expo-video` player) cannot add custom HTTP headers. Jellyfin API requires authentication for these resources, so the API key **must** be in the query string.

**This is a Jellyfin API design constraint, not a bug in TomoTV.**

### Risk Assessment: LOW

**Why This Is Acceptable:**

1. **HTTPS Encryption:** URLs are encrypted in transit for remote servers
2. **Limited Scope:** API keys grant Jellyfin API access only (not system-level)
3. **Revocable:** Users can regenerate API keys from Jellyfin dashboard
4. **Standard Practice:** All Jellyfin clients face this same constraint

### Mitigations

**Required:**
- Use HTTPS for remote servers (encrypts URLs in transit)

**Recommended:**
- Create dedicated API key for TomoTV with minimal permissions
- Rotate API keys periodically
- Monitor Jellyfin server access logs

**For Maximum Security:**
- Use Jellyfin server on local network only
- Enable Jellyfin's IP whitelist feature
- Use VPN for remote access instead of exposing server to internet

---

## 4. Input Validation

### Server URL Validation

**Implementation:** `app/(tabs)/settings.tsx`

```typescript
const parsedUrl = new URL(trimmedUrl);
if (!parsedUrl.protocol.startsWith("http")) {
  return { valid: false, error: "Must start with http:// or https://" };
}
```

**Validates:**
- ✅ Protocol must be HTTP or HTTPS
- ✅ URL must be parseable
- ✅ Trims whitespace
- ✅ Rejects malformed URLs

### API Key Validation

**Regex:** `^[a-zA-Z0-9]{16,64}$`

**Validates:**
- ✅ Only alphanumeric characters
- ✅ 16-64 character length
- ✅ Prevents special characters that could cause injection

### User ID Validation

**Regex:** GUID format with/without dashes

**Validates:**
- ✅ Standard GUID format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- ✅ Compact format: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- ✅ Only hex characters (0-9, a-f)

### Search Query Validation

**Implementation:** `services/jellyfinApi.ts` (parseYearsFromQuery)

**Validates:**
- ✅ Year formats: 4-digit years only
- ✅ Date ranges: validates start < end
- ✅ Decade parsing: "90s", "2000s"
- ✅ Prevents injection via regex pattern matching

**API Usage:**
- Uses `URLSearchParams` for proper encoding
- Prevents SQL/NoSQL injection via query escaping

---

## 5. Error Handling & Information Disclosure

### Production vs. Development

**Production Builds:**
- ✅ No debug information in error messages
- ✅ No stack traces shown to users
- ✅ Generic error messages only

**Development Builds (`__DEV__` mode):**
- Debug info shown for troubleshooting
- Full error details in console
- Not included in App Store builds

### Sensitive Data in Errors

**Protected:**
- ✅ API keys never appear in user-facing errors
- ✅ Server URLs shown only in Settings (intentional)
- ✅ Credentials sanitized from logs

**Example:** Demo server error handling (jellyfinApi.ts):
```typescript
if (response.status === 503) {
  throw new Error("Demo server is temporarily unavailable. Please try again in a few moments.");
}
```

User sees friendly message, not raw API response.

---

## 6. expo-tvos-search Package Security

### Input Validation (Swift Layer)

**Validation Enforced:**
- ✅ URL scheme: Only HTTP/HTTPS image URLs accepted
- ✅ String length: 500 character max for all text fields
- ✅ Numeric ranges: All numeric props clamped to safe ranges
- ✅ Array size: Max 500 search results
- ✅ Empty filtering: Results with missing id/title skipped

**Validation Warnings:**
Non-fatal validation warnings emitted as events (not crashes).

**Examples:**
- Card dimensions: 50-1000 pixels (clamped)
- Columns: 1-10 (clamped)
- Font size: 8-72 points (clamped)

### Image Loading

**Security:**
- ✅ Only HTTP/HTTPS URLs allowed
- ✅ No file:// or javascript: scheme support
- ✅ SwiftUI's AsyncImage handles downloads (system-level security)

---

## 7. Dependency Security

### Current Status (January 2026)

**Security-Critical Packages:**
- `expo-secure-store@15.0.7` - ✅ Current
- `expo-video@3.0.14` - ✅ Current
- `react@19.1.0` - ✅ Latest
- `react-native-tvos@0.81.4-0` - ✅ Maintained fork

**Known Issues:**
- None affecting security

---

## 8. Attack Vectors & Mitigations

### Successfully Mitigated

✅ **Credential Injection via Settings Input**
- Mitigation: Strict validation (regex, URL parsing)

✅ **URL Injection in Stream URLs**
- Mitigation: URLSearchParams encoding, validation

✅ **Search Query Injection**
- Mitigation: Year parsing with regex, parameter encoding

✅ **Man-in-the-Middle Attacks (Remote)**
- Mitigation: HTTPS required for internet servers

✅ **Credential Exposure in Error Messages**
- Mitigation: Generic errors in production, sanitized logs

✅ **Hardcoded Secrets**
- Mitigation: All credentials in SecureStore, .env.local git-ignored

✅ **Demo Credentials Overwriting User Credentials**
- Mitigation: IS_DEMO_MODE flag prevents dev credential sync

### Out of Scope (Not App Responsibility)

⚠️ **Local Network Interception**
- User responsibility to secure home network
- Recommend WPA3 encryption, strong WiFi password

⚠️ **Jellyfin Server Security**
- External service beyond app control
- User should keep Jellyfin updated

⚠️ **Device OS Security**
- iOS/Android platform responsibility
- App inherits platform security features

---

## 9. Secure Development Checklist

**For Contributors:**

- [ ] Never commit `.env.local` to git
- [ ] Use `EXPO_PUBLIC_` prefix for environment variables
- [ ] Store all credentials in SecureStore (never localStorage)
- [ ] Validate all user inputs (URLs, search queries, settings)
- [ ] Use HTTPS for production servers (require in docs)
- [ ] Sanitize logs (check for API keys, passwords before logging)
- [ ] Test with demo server first (validates API integration)
- [ ] Review error messages (ensure no sensitive data)
- [ ] Use `URLSearchParams` for query string building
- [ ] Add timeout to all network requests
- [ ] Validate Jellyfin API responses (check for expected fields)

---

## 10. Threat Model

### Assets to Protect

1. **User Credentials** (API key, server URL, user ID)
2. **Media Access** (playback URLs, library contents)
3. **User Privacy** (viewing history, search queries)

### Trust Boundaries

**Trusted:**
- iOS/Android OS secure storage
- User's device
- User's Jellyfin server

**Untrusted:**
- Network (WiFi, internet)
- Server logs
- Third-party analytics (none used)

### Threat Scenarios

| Threat | Likelihood | Impact | Mitigation |
|--------|-----------|--------|------------|
| Credential theft from device | LOW | HIGH | Secure storage, device encryption |
| API key interception | LOW | MEDIUM | HTTPS required |
| Jellyfin server compromise | MEDIUM | HIGH | Out of scope (user responsibility) |
| Man-in-the-middle attack | LOW | MEDIUM | HTTPS for remote servers |
| Malicious server URL injection | LOW | LOW | URL validation |

---

## 11. Security Audit History

| Date | Auditor | Findings | Status |
|------|---------|----------|--------|
| 2026-01-22 | Claude Code | No critical issues | ✅ PASSED |

---

## 12. Recommendations for Users

**For Maximum Security:**

1. **Use HTTPS:** Always configure Jellyfin with SSL/TLS certificate
2. **Strong API Keys:** Let Jellyfin generate keys (32+ character random)
3. **Dedicated API Key:** Create separate key for TomoTV with limited permissions
4. **Local Network Only:** Avoid exposing Jellyfin to public internet
5. **VPN for Remote:** Use VPN instead of port forwarding
6. **Keep Updated:** Update Jellyfin server regularly
7. **Monitor Logs:** Check Jellyfin access logs for suspicious activity
8. **Secure WiFi:** Use WPA3 encryption on home network
9. **Device Lock:** Enable PIN/biometric lock on TV devices

---

## Contact

**Security Concerns:**
Report security issues to the repository maintainer via GitHub Issues with [SECURITY] tag.

**NOT Security Issues:**
- API keys in URLs (documented design constraint)
- Local HTTP connections (intentional for home servers)
- Debug logs in development (stripped in production)
