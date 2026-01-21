require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();

/* ---------------- MIDDLEWARE ---------------- */

app.use(express.json());

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));

// CORS (safe)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

/* ---------------- APP LOGIC ---------------- */

const jobs = new Map();

const AKOOL_API_KEY = process.env.AKOOL_API_KEY;
const AKOOL_API_URL = 'https://openapi.akool.com/api/open/v3';
const DEFAULT_AVATAR_ID =
  process.env.AKOOL_AVATAR_ID || 'dvp_Tristan_cloth2_1080P';

const TONE_CONFIG = {
  serious: { voice_id: 'en-US-GuyNeural', speed: 0.9, pitch: -2 },
  calm: { voice_id: 'en-US-JennyNeural', speed: 0.85, pitch: 0 },
  fake: { voice_id: 'en-US-AriaNeural', speed: 1.0, pitch: 1 }
};

function wrapMessage(text) {
  return `This message is being sent ONRECORD.\n\n${text}\n\nThank you.`;
}

const WATERMARK_TEXT = 'ONRECORD - This message is on record.';

/* ---------------- API ROUTES ---------------- */

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/generate', async (req, res) => {
  try {
    const { text, tone = 'serious', paid = false } = req.body;
    if (!text) return res.status(400).json({ error: 'Message required' });

    const jobId = `job_${Date.now()}`;
    jobs.set(jobId, { status: 'processing' });

    const response = await axios.post(
      `${AKOOL_API_URL}/avatar/createVideoByText`,
      {
        avatar_id: DEFAULT_AVATAR_ID,
        text: wrapMessage(text),
        ...TONE_CONFIG[tone],
        watermark: paid
          ? null
          : { text: WATERMARK_TEXT, position: 'bottom-left' }
      },
      {
        headers: {
          Authorization: `Bearer ${AKOOL_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const videoUrl = response.data?.data?.video_url;
    if (videoUrl) {
      jobs.set(jobId, { status: 'completed', videoUrl });
      return res.json({ jobId, videoUrl });
    }

    res.json({ jobId });
  } catch (e) {
    res.status(500).json({ error: 'Generation failed' });
  }
});

app.get('/api/status/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Not found' });
  res.json(job);
});

/* ---------------- FRONTEND FALLBACK ---------------- */

// VERY IMPORTANT — this serves index.html for /
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* ---------------- VERCEL EXPORT ---------------- */

module.exports = app;
