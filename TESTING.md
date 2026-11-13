# Real-Device Testing Guide — RapidCare SOS & MedAssist

This guide walks through testing **RapidCare SOS** end-to-end on a physical **Android** or **iPhone** via **Expo Go**, connected to your local Node/Express backend in safe sandbox/test mode.

> [!CAUTION]
> **Safety Rules During Testing:**
> - **Never complete a real call to `108` or `112`.** When testing emergency call buttons, verify that your device opens the native dialer pre-filled with `108` or `112`, then tap **Cancel / Back** immediately.
> - **Never send SMS alerts to unsuspecting people.** Use only your own Twilio-verified test number during trial testing.
> - **Keep `UBER_ENV=sandbox`** (default) in `server/.env` so rides are never dispatched to real drivers.
> - **Keep `ENABLE_OUTBOUND_EMERGENCY_CALL=false`** (default) so Twilio never places live automated voice calls.

---

## 1. Pre-Flight Setup (Do This Once)

### A. Uber Developer Dashboard Setup
1. Log in to the [Uber Developer Dashboard](https://developer.uber.com/) and open your app.
2. Under **Setup ➔ Redirect URIs**, save the exact callback URL that matches `UBER_REDIRECT_URI` in `server/.env`:
   - If using ngrok (recommended for real-phone OAuth): `https://<your-id>.ngrok-free.app/api/uber/callback`
   - If using local computer browser/simulator: `http://localhost:5000/api/uber/callback`
3. Under **Members**, ensure the Uber rider account you will sign in with is registered in your Uber Developer Organization (Uber restricts rides until full production access is approved).
4. Verify `UBER_CLIENT_ID`, `UBER_CLIENT_SECRET`, and `UBER_ENV=sandbox` in `server/.env`.

### B. Twilio Setup & India DLT Notice
1. On a **Twilio Trial Account**, Twilio only delivers SMS to numbers listed under **Twilio Console ➔ Phone Numbers ➔ Verified Caller IDs**. Verify your own test phone number there.
2. **If testing unverified numbers:** The backend detects Twilio error `21608`, stops cleanly, and RapidCare SOS opens your phone's native SMS composer (`expo-sms`) as a fallback.
3. **India (`+91`) Production Requirement (TRAI DLT):** Before sending live production SMS in India via Twilio or MSG91, you must complete **TRAI DLT registration** (Entity ID, approved 6-character Sender ID, and pre-approved template IDs). Update `EXPO_PUBLIC_SMS_TEMPLATE_*` in `rapidcare-sos/.env` and `SMS_TEMPLATE_*` in `server/.env` to match your approved DLT wording.

### C. Install Expo Go on Your Phone
- **Android:** Install **Expo Go** from Google Play Store.
- **iPhone:** Install **Expo Go** from the Apple App Store.

---

## 2. Configure Phone-to-Server Connectivity (`EXPO_PUBLIC_API_URL`)

Physical phones **cannot** reach `http://localhost:5000` (that points to the phone itself). Choose **Option A** (same Wi-Fi) or **Option B** (`ngrok`, works on any Wi-Fi/4G/5G and supports Uber OAuth HTTPS callbacks).

### Option A: Same Wi-Fi Network (LAN IP)
1. Find your computer's local IPv4 address:
   - **Windows (PowerShell):** `ipconfig` (look for `IPv4 Address` under Wi-Fi, e.g. `192.168.29.118`)
   - **macOS:** `ipconfig getifaddr en0`
2. Ensure Windows Defender Firewall / macOS Firewall permits inbound connections on TCP port `5000`.
3. Edit `rapidcare-sos/.env`:
   ```env
   EXPO_PUBLIC_API_URL=http://192.168.29.118:5000
   ```

### Option B: `ngrok` Tunnel (Recommended for Physical Phone + Uber OAuth)
1. Install [ngrok](https://ngrok.com/download) and authenticate (`ngrok config add-authtoken <token>`).
2. In a terminal, expose your local backend port `5000`:
   ```bash
   ngrok http 5000
   ```
3. Copy the HTTPS forwarding URL shown by ngrok (e.g. `https://a1b2c3d4.ngrok-free.app`).
4. Update `rapidcare-sos/.env`:
   ```env
   EXPO_PUBLIC_API_URL=https://a1b2c3d4.ngrok-free.app
   ```
5. Update `server/.env`:
   ```env
   UBER_REDIRECT_URI=https://a1b2c3d4.ngrok-free.app/api/uber/callback
   ```
6. Save that **exact same** `https://a1b2c3d4.ngrok-free.app/api/uber/callback` in your **Uber Developer Dashboard ➔ Setup ➔ Redirect URIs**.

---

## 3. Start Backend & Expo App

### Terminal 1 — Start Backend Server
```bash
cd server
npm run dev
```
Check startup output:
- Confirm `Server running on port 5000` and MongoDB connected.
- Confirm there is NO `UBER_REDIRECT_URI` missing warning.

### Terminal 2 — Start RapidCare SOS Mobile App
```bash
cd rapidcare-sos
npx expo start -c
```
*(The `-c` flag clears Metro's cache so edits to `.env` take effect immediately.)*

- **Android:** Open **Expo Go** ➔ tap **Scan QR code** ➔ scan the terminal QR code.
- **iPhone:** Open the default **Camera** app ➔ point at the QR code ➔ tap the **Open in Expo Go** banner.
- *Tip:* If your Wi-Fi blocks local peer connections to Metro, start Expo with `npx expo start --tunnel -c`.

---

## 4. Verify Server Connectivity In-App

1. On the **RapidCare SOS Home Screen**, tap **Settings** (top-right).
2. Under **Backend Server Connectivity**, verify `API URL` shows your LAN IP or ngrok URL (and NOT `localhost`).
3. Tap **Test server connection**.
4. Expected output:
   `✅ Connected (<ms>) — Status: ok | Uber: sandbox | SMS: Twilio`
   If it fails, the exact error (timeout, firewall refusal, or localhost warning) is shown right below the button.

---

## 5. Physical Device Test Plan

### Test 1: Emergency Contacts Picker & Validation
1. Tap **Contacts (0/5)** ➔ tap **Add from Phone Contacts**.
2. Grant contact permission if prompted by the fallback picker, or pick 1 contact using the OS contact card (verify the entire address book is not imported).
3. Add another contact manually (e.g. `9876543210`) and verify it normalizes to `+919876543210`.
4. Test **Edit** and **Remove**, and confirm the cap of **5 contacts**.

### Test 2: Uber Disconnected Path
1. Open **Settings** and make sure Uber shows **Connect Uber Account** (disconnected).
2. On Home, tap **SOS**.
3. Verify:
   - GPS acquires your location and displays your **pickup street address**.
   - Nearest hospital is found (OpenStreetMap Overpass works with zero Google API key).
   - Countdown card shows Pickup Address, Hospital Name, and **`Fare unavailable, connect Uber`**.
   - When the 5s countdown ends, it opens the **Uber deep link fallback** (`uber://` or `m.uber.com`) with pickup and dropoff prefilled, and **108 / 112 call buttons** stay clearly visible.

### Test 3: Uber Sandbox Connected Path vs Local Simulation & 45s Watchdog

#### Setting up the Real Uber Sandbox Path (`"source": "uber-sandbox"`)
By default, if no user OAuth token exists in MongoDB (`UberConnection`) AND Uber's `client_credentials` token exchange is unavailable, `server/routes/uberRoutes.js` falls back to a **local simulation** in `UBER_ENV=sandbox` mode. To call Uber's **real sandbox API** (`https://sandbox-api.uber.com/v1.2`):
1. In `server/.env`, ensure `UBER_ENV=sandbox`, `UBER_CLIENT_ID`, and the exact matching `UBER_CLIENT_SECRET` are set.
2. Save the exact `UBER_REDIRECT_URI` (e.g. `https://<your-id>.ngrok-free.app/api/uber/callback`) in **Uber Developer Dashboard ➔ Setup ➔ Redirect URIs**.
3. Ensure your Uber test account has the **`request` scope** granted and is listed under **Members** in your Uber Developer Dashboard.
4. In the mobile app, open **Settings ➔ Connect Uber Account** and complete the Uber OAuth login in the browser so the server encrypts and saves your OAuth `access_token` in MongoDB (`UberConnection`).

#### How to Confirm It Is NOT Simulated
- **In the Mobile Ride Tracker UI:**
  - Real Uber Sandbox displays the blue **`🧪 UBER SANDBOX (TEST MODE)`** badge.
  - Local simulation displays a prominent orange warning banner: **`⚠️ SIMULATED (LOCAL MOCK — NOT A REAL UBER RIDE)`**.
- **In Server API JSON Responses (`/api/uber/estimate`, `/api/uber/request`, `/api/uber/ride/:id`, `DELETE /api/uber/ride/:id`):**
  - Real Uber Sandbox returns `"source": "uber-sandbox"`, `"isSimulated": false`, and an Uber UUID `ride_id` (not prefixed with `uber_req_`).
  - Local simulation returns `"source": "local-simulation"`, `"isSimulated": true`, and `ride_id` starting with `uber_req_`.

#### Test Steps
1. Open **Settings ➔ Connect Uber Account**.
2. Tap **SOS** and wait through the 5s countdown:
   - Verify estimated fare, street pickup address, and destination hospital appear.
   - Verify auto-booking transitions to the **Live Ride Tracking** card (Driver, Vehicle, License Plate, ETA polling every 5s) and verify whether the **SIMULATED** or **UBER SANDBOX** badge is shown.
   - Tap **Cancel Ride** to verify `DELETE /api/uber/ride/:id`.
3. To test the **45-second watchdog**, keep the ride in non-accepted/deep-link state and let the 45s timer reach `0`:
   - Verify full-screen **EMERGENCY ALERT (108 / 112)** screen appears, SMS #3 triggers, and the background-Uber warning displays.

### Test 4: Twilio Trial & `expo-sms` Fallback
1. Add your **Twilio-verified** test number as contact #1 and trigger SOS -> confirm server SMS succeeds.
2. Add an **unverified** dummy test number (e.g., `+910000000000`) -> server catches Twilio trial error (`21608`) and app automatically opens the device's **SMS compose sheet** (`expo-sms`) with the alert text pre-filled (**do not press Send**).

### Test 5: Failure & Permission Denial Matrix
Confirm each scenario ends cleanly on visible **108 / 112** options and **never crashes**:
1. **Deny Location (GPS):** Turn off Location permission for Expo Go ➔ tap SOS ➔ verify immediate `ALERT_108_112` screen + location-unavailable SMS fallback.
2. **Deny Contacts:** Deny Contacts permission in **Contacts** screen ➔ verify clear alert + manual entry still works + SOS continues without crashing.
3. **Airplane Mode / No Network:** Enable Airplane mode ➔ tap SOS ➔ verify Places & Overpass fail safely (no hardcoded coordinates), `expo-sms` / Share sheet fallback triggers, and `ALERT_108_112` screen renders cleanly.
4. **Server Unreachable:** Stop the Node server (`Ctrl+C` in Terminal 1) ➔ tap **Settings ➔ Test server connection** (verify exact error shown) ➔ tap **SOS** (verify `expo-sms` fallback + Uber deep-link fallback + 108/112 buttons).
5. **108 / 112 Dialer Check:** Tap **CALL 108** ➔ verify native dialer opens with `108` ➔ tap **Cancel** immediately.

---

## Twilio Billing & Abuse Protection

In addition to the server's built-in limits (`SMS_DAILY_CAP=200` global, `SMS_DEVICE_DAILY_CAP=30` per device, `10/hour` per device, max `5` recipients per request):
- **Set a spending limit in the Twilio Console** before deploying or running live tests (`Twilio Console ➔ Billing ➔ Usage Triggers / Spending Limits`). This protects your account if server credentials are ever misused or rotated late.
- Keep `ALLOW_UBER_SIMULATION` unset (`false`) in staging/production; only set `ALLOW_UBER_SIMULATION=true` locally when demonstrating the simulated ride tracker without an Uber OAuth connection.


