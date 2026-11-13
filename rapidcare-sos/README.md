# RapidCare SOS (Primary Mobile App)

[![React Native](https://img.shields.io/badge/React_Native-0.86.3-61DAFB?logo=react&logoColor=black)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo_SDK-57.0-000020?logo=expo&logoColor=white)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

Cross-platform emergency mobile application (iOS & Android) that resolves the nearest emergency hospital, alerts personal contacts via server-sent SMS (with `expo-sms` fallback), displays live fare estimates when Uber is connected, requests an Uber ride automatically (or opens a pre-filled Uber deep link), and enforces a 45-second watchdog safety fallback to 108/112.

> [!WARNING]
> **CRITICAL MEDICAL EMERGENCY NOTICE:** In a real emergency, call 108 (Ambulance) or 112 directly. Commercial rideshare vehicles are not equipped with medical equipment, oxygen, or trained paramedics, and are never an alternative to an Advanced Life Support (ALS) ambulance.

---

## Features

- **Large Tactile SOS Button**: Red emergency button (140x140 dp, minimum 56dp touch target) on the Home Screen.
- **5-Second Cancel Countdown**: Shows resolved pickup street address, hospital destination, and estimated Uber fare (or `"Fare unavailable, connect Uber"` when disconnected) before auto-booking.
- **High-Accuracy GPS & Address**: Locks live location within 12 seconds with fallback to last known location and reverse-geocodes to a human-readable pickup street address.
- **Pre-Lookup Emergency SMS & Fallback**: Sends SMS #1 with Google Maps pin (`https://maps.google.com/?q=LAT,LNG`) before hospital lookup, SMS #2 with hospital name, and SMS #3 on 45s watchdog timeout. Falls back automatically to `expo-sms` (or native Share sheet) if server/Twilio fails.
- **Dual Hospital Lookup**: Google Places Nearby Search falling back to OpenStreetMap Overpass (`amenity=hospital`, `emergency=yes`, 25 km radius). Zero hardcoded coordinates.
- **Uber Auto-Booking & Deep Link Fallback**: Supports Uber OAuth 2.0, `UBER_ENV=sandbox|production`, live 5-second ride polling, and graceful fallback to pre-filled `uber://` / `https://m.uber.com/ul/?...` links.
- **45-Second Watchdog**: Displays persistent 108/112 alert screen and sends SMS #3 if unconfirmed after 45 seconds.

---

## Setup & Configuration

1. **Install dependencies**:
   ```bash
   cd rapidcare-sos
   npm install
   ```

2. **Phone-to-Server Connectivity (`EXPO_PUBLIC_API_URL`)**:
   - Copy `.env.example` to `.env`:
     ```bash
     cp .env.example .env
     ```
   - **Never use `localhost` on a real phone** (`localhost` refers to the phone itself). Choose one of the two options below:
     - **Option A — Same Wi-Fi (LAN IP):**
       1. Find your computer's local IP (`ipconfig` on Windows -> IPv4 Address, or `ipconfig getifaddr en0` on macOS).
       2. Set `EXPO_PUBLIC_API_URL=http://<YOUR_LAN_IP>:5000` (e.g. `http://192.168.1.15:5000`).
       3. Ensure Windows/macOS firewall permits inbound TCP on port `5000`.
     - **Option B — Any Network / Cellular (`ngrok`):**
       1. Start the server (`cd server && npm run dev`).
       2. Run `ngrok http 5000`.
       3. Set `EXPO_PUBLIC_API_URL=https://<your-id>.ngrok-free.app` in `rapidcare-sos/.env`.
   - Open **Settings ➔ Test server connection** in the app to verify reachability (`GET /api/health`).

3. **Uber OAuth Redirect URI**:
   - Set `UBER_REDIRECT_URI` in `server/.env` (e.g. `http://localhost:5000/api/uber/callback` for simulator, or `https://<your-id>.ngrok-free.app/api/uber/callback` for a real phone).
   - Save the **exact same URI** in the **Uber Developer Dashboard ➔ Setup ➔ Redirect URIs**.

4. **India SMS DLT Registration & Configurable Templates**:
   - In India (`+91`), TRAI regulations require **DLT (Distributed Ledger Technology) registration** before sending live automated SMS in production via Twilio or MSG91 (you must register your Entity ID, Sender ID / Header, and exact SMS message templates).
   - During development/sandbox testing, use Twilio **verified caller IDs** or MSG91 sandbox; unverified trial errors automatically open the phone's `expo-sms` composer fallback.
   - To match your DLT-approved text, override templates in `.env` using `EXPO_PUBLIC_SMS_TEMPLATE_LOCATION`, `EXPO_PUBLIC_SMS_TEMPLATE_HOSPITAL`, `EXPO_PUBLIC_SMS_TEMPLATE_WATCHDOG`, and `EXPO_PUBLIC_SMS_TEMPLATE_NO_LOCATION`.

5. **Google Places API Key (Optional)**:
   - Set `EXPO_PUBLIC_PLACES_API_KEY` in `.env` (restricted in Google Cloud Console to Places API & your app bundle ID). If omitted, OpenStreetMap Overpass API is used automatically.

---

## Testing

See [`TESTING.md`](../TESTING.md) for the complete real-phone Android/iOS Expo Go walkthrough.

Run unit tests:
```bash
npm test
```
Type check:
```bash
npx tsc --noEmit
```
Export bundle check:
```bash
npx expo export
```
