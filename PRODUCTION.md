# Production Deployment Guide — BookDoctor & RapidCare SOS

This guide details the requirements, configuration, and manual steps necessary to take BookDoctor and RapidCare SOS to live production.

---

## 1. What You Must Do Yourself (Manual Approvals & Infrastructure)

### A. Uber Developer Platform Production Approval
In testing mode, Uber restricts API bookings to developer sandbox mocks or designated organization members. For live rides with real drivers:
1. Log in to the [Uber Developer Dashboard](https://developer.uber.com/).
2. Submit your application for **Production Access** for the following scopes:
   - `request`: Allows requesting on-demand rides.
   - `request.receipts`: Allows fetching trip status and fares.
   - `profile`: Allows reading rider name and account verification.
3. In `server/.env`, set:
   ```env
   UBER_ENV=production
   UBER_CLIENT_ID=your_production_client_id
   UBER_CLIENT_SECRET=your_production_client_secret
   ```
4. **Safety Rule**: Keep `ALLOW_UBER_SIMULATION=false` (or unset).

### B. HTTPS Server Base URL & Uber OAuth Redirect URI
Uber strictly requires HTTPS callback URLs in production:
1. Deploy the backend server to Render, Railway, AWS, or use `ngrok` for HTTPS tunneling during staging.
2. In `server/.env`, set:
   ```env
   UBER_REDIRECT_URI=https://your-domain.com/api/uber/callback
   ```
3. Save that exact URL in the **Uber Developer Dashboard ➔ App ➔ Setup ➔ Redirect URIs**.
4. In `rapidcare-sos/.env`, set:
   ```env
   EXPO_PUBLIC_API_URL=https://your-domain.com
   ```

### C. Building the Android Mobile App
1. To build the production standalone Android APK / AAB:
   ```bash
   cd rapidcare-sos
   npx eas-cli build --platform android --profile production
   ```
   *(Or generate the native project with `npx expo prebuild` and run `npx expo run:android --variant release`)*
2. **Google Play Store SMS Policy & Permissions Note:**
   - Google Play restricts automated silent background SMS (`android.permission.SEND_SMS`) to default SMS/dialer apps.
   - RapidCare SOS uses the device's native **Messages app composer (`expo-sms`)** where the user taps **Send**. This approach:
     - Is 100% compliant with Google Play Store policies.
     - Requires **zero third-party SMS gateway fees** (no Twilio, no MSG91, no WhatsApp opt-in).
     - Works identically on both **Android** and **iPhone**.

---

## 2. Server Production Startup Safeguards

The backend server (`server/server.js`) enforces strict environment checks when running with `APP_ENV=production`:
- **Refuses to start** if `ALLOW_UBER_SIMULATION` is set or truthy.
- **Refuses to start** if `UBER_ENV` is not `"production"`.
- Validates that `JWT_SECRET` is set and at least 16 characters.
- Requires live Razorpay API keys (`rzp_live_...`) unless `RAZORPAY_ALLOW_TEST_KEYS=true` is explicitly provided.

---

## 3. Production Environment Checklist (`server/.env`)

```env
APP_ENV=production
NODE_ENV=production
PORT=5000

# Database
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/bookdoctor?retryWrites=true&w=majority

# Security
JWT_SECRET=<strong-random-32-char-secret>
ENCRYPTION_SECRET=<32-char-aes-key-for-oauth-tokens>

# Uber Integration (Production)
UBER_ENV=production
UBER_CLIENT_ID=<your-uber-production-client-id>
UBER_CLIENT_SECRET=<your-uber-production-client-secret>
UBER_REDIRECT_URI=https://<your-server-domain>/api/uber/callback
ALLOW_UBER_SIMULATION=false

# Payment (Razorpay Production)
RAZORPAY_KEY_ID=rzp_live_<your_key_id>
RAZORPAY_KEY_SECRET=<your_key_secret>
```

