# 🚀 SETUP NOW — Mbulaheni Call Centre
## Your Twilio Credentials Are Already Configured

```
Account SID : ACddb4fb416e113026a626fca2173b738e
Phone Number: +1 361 304 5386  (your test number)
Forward To  : +27 73 733 5518  (your cellphone)
```

---

## STEP 1 — Verify Your Cellphone in Twilio (Trial Accounts)

Twilio trial accounts can only call **verified numbers**.
You must verify **+27 73 733 5518** before it can receive forwarded calls.

1. Go to: **https://console.twilio.com/us1/develop/phone-numbers/verified-caller-ids**
2. Click **"Add a new Caller ID"**
3. Enter: **+27 73 733 5518**
4. Choose **"Call Me"** — Twilio will call your phone with a 6-digit code
5. Enter the code → **Verified ✓**

> ⚠️ **Without this step, forwarded calls will fail on trial accounts.**

---

## STEP 2 — Deploy the Server (3 Options)

### 🥇 Option A — Railway.app (Recommended, Free)

1. Go to **https://github.com** → Create a new **private** repository called `callcenter`
2. Upload all these files (drag and drop into the repo)
3. Go to **https://railway.app** → Sign in with GitHub
4. Click **"New Project" → "Deploy from GitHub repo"** → Select `callcenter`
5. Railway auto-detects Node.js and deploys
6. Click **"Variables"** tab → Add these:

```
TWILIO_ACCOUNT_SID  = ACddb4fb416e113026a626fca2173b738e
TWILIO_AUTH_TOKEN   = 2557458022c45c0e2ab7b8f9038a9839
TWILIO_PHONE_NUMBER = +13613045386
FORWARD_TO          = +27737335518
ADMIN_PASSWORD      = Mbulaheni2025!
PORT                = 3000
```

7. Railway gives you a URL like: **`https://callcenter-production-xxxx.up.railway.app`**
   Save this URL — you need it for Step 3.

---

### 🥈 Option B — Render.com (Also Free)

1. Go to **https://render.com** → Sign up
2. New → **Web Service** → Connect your GitHub repo
3. Settings:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
4. Add the same environment variables as above
5. Your URL will be: `https://callcenter-xxxx.onrender.com`

---

### 🥉 Option C — Test Locally with ngrok (Fastest to test)

If you just want to test right now on your computer:

```bash
# Terminal 1 — start the server
cd callcenter
npm install
node server.js

# Terminal 2 — expose to internet
npx ngrok http 3000
```

ngrok gives you: `https://xxxx.ngrok.io` — use this as YOUR_URL below.

> ⚠️ ngrok URL changes every time you restart. For permanent use, deploy to Railway.

---

## STEP 3 — Connect Twilio to Your Server

1. Go to: **https://console.twilio.com/us1/develop/phone-numbers/manage/incoming**
2. Click on your number: **+1 (361) 304-5386**
3. Scroll to **"Voice Configuration"**
4. Under **"A call comes in"**:
   - Change dropdown to: **Webhook**
   - Enter URL: `https://YOUR_URL/voice/inbound`
   - Method: **HTTP POST**
5. Under **"Call Status Changes"**:
   - Enter URL: `https://YOUR_URL/voice/status`
   - Method: **HTTP POST**
6. Click **"Save Configuration"** ✓

**Example with Railway URL:**
```
A call comes in:   https://callcenter-production-xxxx.up.railway.app/voice/inbound
Call status changes: https://callcenter-production-xxxx.up.railway.app/voice/status
```

---

## STEP 4 — Test It!

Call **+1 (361) 304-5386** from any phone.

You should hear:
> *"Thank you for calling Mbulaheni Group Integrated Solutions. Please hold while I try to connect you to the next available agent."*

Then your phone **+27 73 733 5518** will ring.

---

## STEP 5 — Open Your Dashboard

Go to: `https://YOUR_URL`

Password: **Mbulaheni2025!**

---

## STEP 6 — Port Your Real Number (When Ready)

To use your actual **087 093 1138** instead of the US test number:

1. Twilio Console → Phone Numbers → **Port & Host a Number**
2. Enter: `+27870931138`
3. Submit porting request — Twilio contacts your provider
4. Timeline: 2–4 weeks
5. When complete, update `.env`: `TWILIO_PHONE_NUMBER=+27870931138`

**Alternative (faster):** Keep your 087 number at your provider and set up a forward:
- Tell Afrihost/Telkom/etc. to forward **087 093 1138** to your Twilio number **+13613045386**
- This works immediately, no porting needed

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Calls not forwarding" | Verify +27737335518 in Twilio Console (Step 1) |
| "Webhook error" | Check your URL is correct and server is running |
| "Authentication error" | Double-check Account SID and Auth Token |
| "No answer" | Make sure your cellphone is on and not in Do Not Disturb |
| Dashboard shows offline | Check server is running at the URL |

---

## Your Exact URLs (fill in YOUR_URL)

| What | URL |
|---|---|
| Dashboard | `https://YOUR_URL/` |
| Inbound webhook | `https://YOUR_URL/voice/inbound` |
| Status callback | `https://YOUR_URL/voice/status` |
| Health check | `https://YOUR_URL/api/health` |

---

## Call Flow Reminder

```
Someone calls +1 361 304 5386
        ↓
Twilio hits /voice/inbound
        ↓
Greeting plays (South African voice)
        ↓
Dials +27 73 733 5518
        ↓
┌── You answer → Connected!
└── No answer (30s) → Voicemail recorded + transcribed
```
