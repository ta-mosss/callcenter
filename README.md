# 📞 Mbulaheni Group — Call Centre System

A complete **IVR + Call Forwarding** system built with **Twilio Programmable Voice** and **Node.js**.

## What It Does

| Feature | Detail |
|---|---|
| **Greeting** | "Thank you for calling Mbulaheni Group Integrated Solutions, please hold while I try to connect you to the next available agent." |
| **Call Forward** | Rings your cellphone **073 733 5518** after the greeting |
| **No-Answer VM** | If no answer in 30s → voicemail with transcription |
| **After Hours** | Nights & weekends → custom message + voicemail |
| **Dashboard** | Live call log, stats, outbound dialler |
| **Call Recording** | Records calls with Twilio's recording API |

---

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Create Your .env File
```bash
cp .env.example .env
```

Edit `.env`:
```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+27870931138
FORWARD_TO=+27737335518
ADMIN_PASSWORD=YourSecurePassword
PORT=3000
```

### 3. Start the Server
```bash
npm start
```

Open: **http://localhost:3000**

---

## Getting a Twilio Number for 087 093 1138

You have two options:

### Option A — Port Your Existing Number (Recommended)
Keep your **087 093 1138** number and move it to Twilio.

1. Go to [Twilio Console](https://console.twilio.com) → Phone Numbers → Port & Host
2. Submit a porting request for **+27870931138**
3. Twilio will contact your current provider (Afrihost, Telkom, etc.)
4. Porting takes **2–4 weeks**
5. Your number keeps working during the transfer

### Option B — Buy a New Twilio ZA Number
Buy any +27 number from Twilio (~R25/month) and forward your old 087 to it via your current provider.

---

## Deploying to Production (Free)

### Railway.app (Easiest)
```bash
# 1. Push to GitHub
git init && git add . && git commit -m "init"
git remote add origin https://github.com/youruser/callcenter.git
git push -u origin main

# 2. Go to railway.app → New Project → Deploy from GitHub
# 3. Add environment variables in Railway dashboard
# 4. Railway gives you a public URL like: https://callcenter-production.up.railway.app
```

### Local Testing with ngrok
```bash
npx ngrok http 3000
# Gives you: https://xxxx.ngrok.io
```

---

## Twilio Webhook Configuration

After deploying, go to:
**Twilio Console → Phone Numbers → Your Number → Voice Configuration**

| Field | Value |
|---|---|
| A call comes in | Webhook · POST · `https://your-domain.com/voice/inbound` |
| Call Status Changes | `https://your-domain.com/voice/status` |

---

## Dashboard

Open `https://your-domain.com` → enter your `ADMIN_PASSWORD`.

| Feature | Description |
|---|---|
| Live Overview | Real-time call stats, today's summary |
| Call Log | Full history with search & filter |
| Outbound Dialler | Click-to-call from the dashboard |
| Configuration | Change forward number & business hours live |
| Setup Guide | Step-by-step instructions |

---

## Voice Customisation

The greeting uses **Amazon Polly Ayanda-Neural** — a natural South African English voice.

To change the greeting, edit `server.js` line ~90:
```js
twiml.say({
  voice: 'Polly.Ayanda-Neural',
  language: 'en-ZA',
}, 'Your custom greeting here.');
```

Other ZA voices available:
- `Polly.Ayanda-Neural` — South African English (female)
- `en-ZA` standard voices via basic Twilio TTS

---

## Call Flow

```
Inbound Call
    │
    ├── Business Hours? YES
    │       │
    │       ├── Play greeting
    │       ├── Hold music
    │       └── Dial +27 73 733 5518
    │               │
    │               ├── Answered → Connected ✓
    │               └── No Answer (30s) → Voicemail
    │
    └── Business Hours? NO
            │
            └── After-hours message → Voicemail → Transcription
```

---

## Costs

| Item | Cost |
|---|---|
| Twilio phone number | ~R25/month |
| Inbound call (ZA) | ~R0.90/min |
| Outbound to mobile (ZA) | ~R1.20/min |
| Polly TTS per call | ~$0.004 |
| Server hosting | Free (Railway/Render) |

---

## Support

- Twilio Docs: https://www.twilio.com/docs/voice
- TwiML Reference: https://www.twilio.com/docs/voice/twiml
- ZA Pricing: https://www.twilio.com/en-us/voice/pricing/za
