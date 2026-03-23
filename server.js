/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Mbulaheni Group Integrated Solutions — Call Centre Server
 *  Built with Twilio Programmable Voice + Express
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  SETUP STEPS:
 *  1. npm install
 *  2. Copy .env.example → .env and fill in your Twilio credentials
 *  3. node server.js  (or use ngrok for local testing)
 *  4. In Twilio Console → Phone Numbers → Your number → Voice URL:
 *     Set to: https://your-domain.com/voice/inbound
 *  5. Status Callback URL: https://your-domain.com/voice/status
 *
 *  DEPLOY OPTIONS (free/cheap):
 *  - Railway.app (easiest, free tier)
 *  - Render.com (free tier)
 *  - Fly.io
 *  - Your own VPS
 */

require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const twilio       = require('twilio');
const rateLimit    = require('express-rate-limit');
const path         = require('path');

const app  = express();
app.set('trust proxy', 1);
const port = process.env.PORT || 3000;

// ─── CONFIG ────────────────────────────────────────────────────────────────
const CONFIG = {
  accountSid:    process.env.TWILIO_ACCOUNT_SID  || 'ACxxxxxxxx',
  authToken:     process.env.TWILIO_AUTH_TOKEN   || 'your_token',
  twilioNumber:  process.env.TWILIO_PHONE_NUMBER || '+27870931138',
  forwardTo:     process.env.FORWARD_TO          || '+27737335518',
  adminPass:     process.env.ADMIN_PASSWORD      || 'Mbulaheni2025!',
  bizStart:      parseInt(process.env.BUSINESS_HOURS_START || '8'),
  bizEnd:        parseInt(process.env.BUSINESS_HOURS_END   || '17'),
  bizDays:       (process.env.BUSINESS_DAYS || '1,2,3,4,5').split(',').map(Number),
};

const VoiceResponse = twilio.twiml.VoiceResponse;
const client        = twilio(CONFIG.accountSid, CONFIG.authToken);

// ─── IN-MEMORY CALL LOG (use a DB in production) ───────────────────────────
const callLog    = [];
const MAX_LOG    = 500;
let   totalCalls = 0;
let   answered   = 0;
let   missed     = 0;
let   forwarded  = 0;

function logCall(data) {
  const entry = {
    id:         `CALL-${Date.now().toString(36).toUpperCase()}`,
    timestamp:  new Date().toISOString(),
    ...data,
  };
  callLog.unshift(entry);
  if (callLog.length > MAX_LOG) callLog.pop();
  totalCalls++;
  return entry;
}

// ─── HELPERS ───────────────────────────────────────────────────────────────
function isBusinessHours() {
  // SAST = UTC+2
  const now  = new Date();
  const sast = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const day  = sast.getUTCDay();
  const hour = sast.getUTCHours();
  return CONFIG.bizDays.includes(day) &&
         hour >= CONFIG.bizStart &&
         hour < CONFIG.bizEnd;
}

function formatPhone(raw = '') {
  return raw.replace(/(\+27|0)(\d{2})(\d{3})(\d{4})/, '0$2 $3 $4');
}

// ─── MIDDLEWARE ─────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Validate Twilio signature on webhook endpoints
// NOTE: Trial accounts skip strict signature check (ngrok URL changes each run)
function validateTwilio(req, res, next) {
  // Skip validation on trial / dev — enable in production by setting VALIDATE_TWILIO=true
  if (process.env.VALIDATE_TWILIO !== 'true') return next();
  const valid = twilio.validateRequest(
    CONFIG.authToken,
    req.headers['x-twilio-signature'] || '',
    `https://${req.headers.host}${req.originalUrl}`,
    req.body
  );
  if (!valid) return res.status(403).send('Forbidden');
  next();
}

// Admin auth middleware
function requireAdmin(req, res, next) {
  const auth = req.headers['x-admin-password'] ||
               req.query.password;
  if (auth === CONFIG.adminPass) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

// Rate limit API calls (not webhooks)
const apiLimiter = rateLimit({ windowMs: 60000, max: 60 });

// ─── SERVE DASHBOARD ───────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});
app.use(express.static(__dirname));

// ═══════════════════════════════════════════════════════════════════════════
//  TWILIO WEBHOOKS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /voice/inbound
 * Called by Twilio when a call arrives on your number.
 * Plays greeting → forwards to agent cellphone.
 */
app.post('/voice/inbound', validateTwilio, (req, res) => {
  const { From, To, CallSid, CallerName } = req.body;

  logCall({
    callSid:    CallSid,
    direction:  'inbound',
    from:       From,
    to:         To,
    callerName: CallerName || 'Unknown',
    status:     'ringing',
    action:     'greeting',
  });

  const twiml   = new VoiceResponse();
  const inBiz   = isBusinessHours();

  if (inBiz) {
    // ── BUSINESS HOURS FLOW ──────────────────────────────────────────────
    // 1. Pause a beat
    twiml.pause({ length: 1 });

    // 2. Greeting
    twiml.say({
      voice:    'Polly.Ayanda-Neural', // South African English (Amazon Polly)
      language: 'en-ZA',
    },
      'Thank you for calling Mbulaheni Group Integrated Solutions. ' +
      'Please hold while I try to connect you to the next available agent.'
    );

    // 3. Hold music (royalty-free Twilio ringtone while connecting)
    twiml.play('https://com.twilio.sounds.music.s3.amazonaws.com/ClockingWaltz.mp3');

    // 4. Dial to agent with 30-second timeout
    const dial = twiml.dial({
      callerId:         CONFIG.twilioNumber,
      timeout:          30,
      action:           '/voice/dial-status',
      method:           'POST',
      record:           'record-from-answer',
      recordingStatusCallback: '/voice/recording',
    });
    dial.number({
      statusCallback:      '/voice/dial-status',
      statusCallbackEvent: 'initiated ringing answered completed',
    }, CONFIG.forwardTo);

    forwarded++;
  } else {
    // ── OUT OF HOURS FLOW ────────────────────────────────────────────────
    twiml.pause({ length: 1 });
    twiml.say({
      voice:    'Polly.Ayanda-Neural',
      language: 'en-ZA',
    },
      'Thank you for calling Mbulaheni Group Integrated Solutions. ' +
      'Our office is currently closed. Our business hours are Monday to ' +
      'Friday, 8 AM to 5 PM, South Africa Standard Time. ' +
      'Please leave a message after the beep, or send us a WhatsApp on ' +
      '0 7 2 6 6 5 0 5 6 5, and we will get back to you as soon as possible. ' +
      'Thank you.'
    );
    twiml.record({
      maxLength:              60,
      transcribe:             true,
      transcribeCallback:     '/voice/transcription',
      action:                 '/voice/voicemail-done',
      playBeep:               true,
      recordingStatusCallback:'/voice/recording',
    });

    missed++;
    logCall({
      callSid:   CallSid,
      direction: 'inbound',
      from:      From,
      status:    'voicemail',
      action:    'after-hours',
    });
  }

  res.set('Content-Type', 'text/xml');
  res.send(twiml.toString());
});

/**
 * POST /voice/dial-status
 * Called after the <Dial> completes — handle no-answer / busy.
 */
app.post('/voice/dial-status', validateTwilio, (req, res) => {
  const { DialCallStatus, CallSid } = req.body;
  const twiml = new VoiceResponse();

  const idx = callLog.findIndex(c => c.callSid === CallSid);
  if (idx !== -1) {
    callLog[idx].dialStatus = DialCallStatus;
    callLog[idx].status     = DialCallStatus === 'completed' ? 'answered' : 'missed';
    if (callLog[idx].status === 'answered') answered++;
    else missed++;
  }

  if (DialCallStatus === 'no-answer' || DialCallStatus === 'busy' || DialCallStatus === 'failed') {
    twiml.say({
      voice:    'Polly.Ayanda-Neural',
      language: 'en-ZA',
    },
      'Our agent is currently unavailable. Please leave a message after ' +
      'the beep and we will call you back shortly. Thank you.'
    );
    twiml.record({
      maxLength:               60,
      transcribe:              true,
      transcribeCallback:      '/voice/transcription',
      action:                  '/voice/voicemail-done',
      playBeep:                true,
      recordingStatusCallback: '/voice/recording',
    });
  } else {
    twiml.say({
      voice:    'Polly.Ayanda-Neural',
      language: 'en-ZA',
    }, 'Thank you for calling Mbulaheni Group. Goodbye.');
    twiml.hangup();
  }

  res.set('Content-Type', 'text/xml');
  res.send(twiml.toString());
});

/**
 * POST /voice/voicemail-done
 */
app.post('/voice/voicemail-done', validateTwilio, (req, res) => {
  const twiml = new VoiceResponse();
  twiml.say({
    voice:    'Polly.Ayanda-Neural',
    language: 'en-ZA',
  }, 'Your message has been recorded. Thank you for calling Mbulaheni Group. Goodbye.');
  twiml.hangup();
  res.set('Content-Type', 'text/xml');
  res.send(twiml.toString());
});

/**
 * POST /voice/status  — Twilio status callback for any call
 */
app.post('/voice/status', validateTwilio, (req, res) => {
  const { CallSid, CallStatus, CallDuration } = req.body;
  const idx = callLog.findIndex(c => c.callSid === CallSid);
  if (idx !== -1) {
    callLog[idx].finalStatus = CallStatus;
    callLog[idx].duration    = CallDuration ? parseInt(CallDuration) : null;
    if (CallStatus === 'completed' && !callLog[idx].status) {
      callLog[idx].status = 'answered';
      answered++;
    }
  }
  res.sendStatus(204);
});

/**
 * POST /voice/recording — recording ready callback
 */
app.post('/voice/recording', validateTwilio, (req, res) => {
  const { CallSid, RecordingUrl, RecordingDuration } = req.body;
  const idx = callLog.findIndex(c => c.callSid === CallSid);
  if (idx !== -1) {
    callLog[idx].recordingUrl      = RecordingUrl;
    callLog[idx].recordingDuration = RecordingDuration;
  }
  res.sendStatus(204);
});

/**
 * POST /voice/transcription — voicemail transcription
 */
app.post('/voice/transcription', validateTwilio, (req, res) => {
  const { CallSid, TranscriptionText, RecordingUrl } = req.body;
  const idx = callLog.findIndex(c => c.callSid === CallSid);
  if (idx !== -1) {
    callLog[idx].transcription = TranscriptionText;
    callLog[idx].recordingUrl  = callLog[idx].recordingUrl || RecordingUrl;
  }
  res.sendStatus(204);
});

// ═══════════════════════════════════════════════════════════════════════════
//  DASHBOARD API ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/stats — summary statistics
 */
app.get('/api/stats', apiLimiter, requireAdmin, (req, res) => {
  const now   = new Date();
  const today = now.toISOString().slice(0, 10);

  const todaysCalls = callLog.filter(c => c.timestamp.startsWith(today));

  res.json({
    total:         totalCalls,
    answered,
    missed,
    forwarded,
    todayTotal:    todaysCalls.length,
    todayAnswered: todaysCalls.filter(c => c.status === 'answered').length,
    todayMissed:   todaysCalls.filter(c => c.status === 'missed' || c.status === 'voicemail').length,
    isBusinessHours: isBusinessHours(),
    forwardTo:     CONFIG.forwardTo,
    twilioNumber:  CONFIG.twilioNumber,
    uptime:        Math.floor(process.uptime()),
    serverTime:    new Date().toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' }),
  });
});

/**
 * GET /api/calls — call log
 */
app.get('/api/calls', apiLimiter, requireAdmin, (req, res) => {
  const { limit = 50, offset = 0, status, search } = req.query;
  let results = [...callLog];

  if (status && status !== 'all') results = results.filter(c => c.status === status);
  if (search) {
    const q = search.toLowerCase();
    results  = results.filter(c =>
      (c.from||'').toLowerCase().includes(q) ||
      (c.callerName||'').toLowerCase().includes(q) ||
      (c.id||'').toLowerCase().includes(q)
    );
  }

  res.json({
    total:   results.length,
    calls:   results.slice(Number(offset), Number(offset) + Number(limit)),
  });
});

/**
 * POST /api/call/outbound — make an outbound call from the dashboard
 */
app.post('/api/call/outbound', apiLimiter, requireAdmin, async (req, res) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ error: 'Missing "to" number' });

  try {
    const call = await client.calls.create({
      from:  CONFIG.twilioNumber,
      to,
      twiml: `<Response><Say voice="Polly.Ayanda-Neural" language="en-ZA">Hello, this is a call from Mbulaheni Group Integrated Solutions. Please hold.</Say></Response>`,
    });
    logCall({
      callSid:   call.sid,
      direction: 'outbound',
      from:      CONFIG.twilioNumber,
      to,
      status:    'initiated',
      action:    'manual-outbound',
    });
    res.json({ success: true, callSid: call.sid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/config — update forward number live
 */
app.patch('/api/config', apiLimiter, requireAdmin, (req, res) => {
  const { forwardTo, bizStart, bizEnd } = req.body;
  if (forwardTo) CONFIG.forwardTo = forwardTo;
  if (bizStart !== undefined) CONFIG.bizStart = parseInt(bizStart);
  if (bizEnd   !== undefined) CONFIG.bizEnd   = parseInt(bizEnd);
  res.json({ success: true, config: { forwardTo: CONFIG.forwardTo, bizStart: CONFIG.bizStart, bizEnd: CONFIG.bizEnd } });
});

/**
 * GET /api/health — public health check
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Mbulaheni Call Centre', uptime: Math.floor(process.uptime()) });
});

// ─── START ─────────────────────────────────────────────────────────────────
app.listen(port, () => {
  console.log(`\n${'═'.repeat(60)}`);
  console.log('  Mbulaheni Group — Call Centre Server');
  console.log(`${'═'.repeat(60)}`);
  console.log(`  ✓  Server running on http://localhost:${port}`);
  console.log(`  ✓  Dashboard: http://localhost:${port}`);
  console.log(`  ✓  Inbound webhook: POST /voice/inbound`);
  console.log(`  ✓  Status callback: POST /voice/status`);
  console.log(`  ✓  Forward to: ${CONFIG.forwardTo}`);
  console.log(`  ✓  Business hours: ${CONFIG.bizStart}:00 – ${CONFIG.bizEnd}:00 SAST`);
  console.log(`\n  📌 Ngrok (for testing):`);
  console.log(`     npx ngrok http ${port}`);
  console.log(`     Then set Twilio Voice URL to:`);
  console.log(`     https://xxxx.ngrok.io/voice/inbound`);
  console.log(`${'═'.repeat(60)}\n`);
});

module.exports = app;
