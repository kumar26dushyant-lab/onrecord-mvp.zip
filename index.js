require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();

// Parse JSON
app.use(express.json());

// ✅ CORS (bulletproof, works with Vercel)
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); // OK for now
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

// In-memory job storage
const jobs = new Map();

// Akool API Configuration
const AKOOL_API_KEY = process.env.AKOOL_API_KEY;
const AKOOL_API_URL = 'https://openapi.akool.com/api/open/v3';
const DEFAULT_AVATAR_ID =
    process.env.AKOOL_AVATAR_ID || 'dvp_Tristan_cloth2_1080P';

// Tone configurations
const TONE_CONFIG = {
    serious: { voice_id: 'en-US-GuyNeural', speed: 0.9, pitch: -2 },
    calm: { voice_id: 'en-US-JennyNeural', speed: 0.85, pitch: 0 },
    fake: { voice_id: 'en-US-AriaNeural', speed: 1.0, pitch: 1 }
};

function wrapMessage(text) {
    return `This message is being sent ONRECORD.\n\n${text}\n\nThank you.`;
}

const WATERMARK_TEXT = 'ONRECORD - This message is on record.';

// Root
app.get('/', (req, res) => {
    res.json({ message: 'ONRECORD API running', status: 'ok' });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Generate video
app.post('/api/generate', async (req, res) => {
    try {
        const { text, tone = 'serious', paid = false } = req.body;

        if (!text || text.trim().length === 0) {
            return res.status(400).json({ error: 'Message text is required' });
        }

        if (text.length > 500) {
            return res.status(400).json({ error: 'Message too long. Max 500 characters.' });
        }

        if (!AKOOL_API_KEY) {
            return res.status(500).json({ error: 'API not configured' });
        }

        const fullScript = wrapMessage(text.trim());
        const toneSettings = TONE_CONFIG[tone] || TONE_CONFIG.serious;

        const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2)}`;

        jobs.set(jobId, {
            status: 'processing',
            createdAt: new Date(),
            paid
        });

        const akoolResponse = await axios.post(
            `${AKOOL_API_URL}/avatar/createVideoByText`,
            {
                avatar_id: DEFAULT_AVATAR_ID,
                text: fullScript,
                voice_id: toneSettings.voice_id,
                speed: toneSettings.speed,
                pitch: toneSettings.pitch,
                background_color: '#1a1a1a',
                watermark: paid
                    ? null
                    : {
                          text: WATERMARK_TEXT,
                          position: 'bottom-left',
                          font_size: 14,
                          color: '#ffffff',
                          opacity: 0.8
                      }
            },
            {
                headers: {
                    Authorization: `Bearer ${AKOOL_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const data = akoolResponse.data?.data;

        if (!data) {
            throw new Error('Invalid Akool response');
        }

        const akoolJobId = data.id || data._id;

        jobs.set(jobId, { ...jobs.get(jobId), akoolJobId });

        if (data.video_url) {
            jobs.set(jobId, {
                ...jobs.get(jobId),
                status: 'completed',
                videoUrl: data.video_url
            });

            return res.json({
                success: true,
                jobId,
                videoUrl: data.video_url
            });
        }

        return res.json({
            success: true,
            jobId,
            message: 'Video generation started'
        });

    } catch (error) {
        console.error('Generation error:', error.response?.data || error.message);
        return res.status(500).json({ error: 'Failed to generate video' });
    }
});

// Check status
app.get('/api/status/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = jobs.get(jobId);

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        if (job.status === 'completed' || job.status === 'failed') {
            return res.json(job);
        }

        if (job.akoolJobId && AKOOL_API_KEY) {
            const statusResponse = await axios.get(
                `${AKOOL_API_URL}/avatar/getVideo/${job.akoolJobId}`,
                { headers: { Authorization: `Bearer ${AKOOL_API_KEY}` } }
            );

            const akoolData = statusResponse.data?.data;

            if (akoolData?.video_url) {
                jobs.set(jobId, {
                    ...job,
                    status: 'completed',
                    videoUrl: akoolData.video_url
                });

                return res.json({
                    status: 'completed',
                    videoUrl: akoolData.video_url
                });
            }
        }

        return res.json({ status: 'processing' });

    } catch (error) {
        return res.status(500).json({ error: 'Failed to check status' });
    }
});

// ✅ VERY IMPORTANT FOR VERCEL
module.exports = app;
