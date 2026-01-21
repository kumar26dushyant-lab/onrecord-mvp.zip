require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS Configuration - Allow your domain
const corsOptions = {
    origin: [
        'https://onrecordai.fun',
        'http://onrecordai.fun',
        'https://www.onrecordai.fun',
        'http://localhost:3000',
        'http://localhost:5500',
        'http://127.0.0.1:5500'
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Parse JSON
app.use(express.json());

// In-memory job storage (use Redis/DB in production)
const jobs = new Map();

// Akool API Configuration
const AKOOL_API_KEY = process.env.AKOOL_API_KEY;
const AKOOL_API_URL = 'https://openapi.akool.com/api/open/v3';

// Avatar configuration (use one consistent avatar)
const DEFAULT_AVATAR_ID = process.env.AKOOL_AVATAR_ID || 'dvp_Tristan_cloth2_1080P';

// Tone configurations
const TONE_CONFIG = {
    serious: {
        voice_id: 'en-US-GuyNeural',
        speed: 0.9,
        pitch: -2
    },
    calm: {
        voice_id: 'en-US-JennyNeural',
        speed: 0.85,
        pitch: 0
    },
    fake: {
        voice_id: 'en-US-AriaNeural',
        speed: 1.0,
        pitch: 1
    }
};

// Script wrapper template
function wrapMessage(text) {
    return `This message is being sent ONRECORD.

${text}

Thank you.`;
}

// Watermark text for free version
const WATERMARK_TEXT = '⚠️ ONRECORD - This message is on record. Don\'t panic.';

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({ message: 'ONRECORD API is running', endpoints: ['/api/health', '/api/generate', '/api/status/:jobId'] });
});

// Generate video endpoint
app.post('/api/generate', async (req, res) => {
    try {
        const { text, tone = 'serious', paid = false } = req.body;

        // Validation
        if (!text || text.trim().length === 0) {
            return res.status(400).json({ error: 'Message text is required' });
        }

        if (text.length > 500) {
            return res.status(400).json({ error: 'Message too long. Max 500 characters.' });
        }

        if (!AKOOL_API_KEY) {
            return res.status(500).json({ error: 'API not configured. Contact support.' });
        }

        // Wrap the message with template
        const fullScript = wrapMessage(text.trim());
        
        // Get tone settings
        const toneSettings = TONE_CONFIG[tone] || TONE_CONFIG.serious;

        // Generate unique job ID
        const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Store job status
        jobs.set(jobId, {
            status: 'processing',
            createdAt: new Date(),
            paid: paid
        });

        // Call Akool API to create video
        const akoolResponse = await axios.post(
            `${AKOOL_API_URL}/avatar/createVideoByText`,
            {
                avatar_id: DEFAULT_AVATAR_ID,
                text: fullScript,
                voice_id: toneSettings.voice_id,
                speed: toneSettings.speed,
                pitch: toneSettings.pitch,
                background_color: '#1a1a1a',
                watermark: paid ? null : {
                    text: WATERMARK_TEXT,
                    position: 'bottom-left',
                    font_size: 14,
                    color: '#ffffff',
                    opacity: 0.8
                },
                webhookUrl: process.env.WEBHOOK_URL || null
            },
            {
                headers: {
                    'Authorization': `Bearer ${AKOOL_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        // Check Akool response
        if (akoolResponse.data && akoolResponse.data.data) {
            const akoolJobId = akoolResponse.data.data.id || akoolResponse.data.data._id;
            
            // Update job with Akool job ID
            jobs.set(jobId, {
                ...jobs.get(jobId),
                akoolJobId: akoolJobId
            });

            // If video URL is immediately available
            if (akoolResponse.data.data.video_url) {
                jobs.set(jobId, {
                    ...jobs.get(jobId),
                    status: 'completed',
                    videoUrl: akoolResponse.data.data.video_url
                });

                return res.json({
                    success: true,
                    jobId: jobId,
                    videoUrl: akoolResponse.data.data.video_url
                });
            }

            return res.json({
                success: true,
                jobId: jobId,
                message: 'Video generation started'
            });
        }

        throw new Error('Invalid response from video API');

    } catch (error) {
        console.error('Generation error:', error.response?.data || error.message);
        
        return res.status(500).json({
            error: 'Failed to generate video. Please try again.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Check job status endpoint
app.get('/api/status/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = jobs.get(jobId);

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        // If already completed or failed, return cached status
        if (job.status === 'completed' || job.status === 'failed') {
            return res.json({
                status: job.status,
                videoUrl: job.videoUrl,
                error: job.error
            });
        }

        // Check with Akool for status
        if (job.akoolJobId && AKOOL_API_KEY) {
            try {
                const statusResponse = await axios.get(
                    `${AKOOL_API_URL}/avatar/getVideo/${job.akoolJobId}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${AKOOL_API_KEY}`
                        }
                    }
                );

                if (statusResponse.data && statusResponse.data.data) {
                    const akoolData = statusResponse.data.data;

                    if (akoolData.status === 'completed' || akoolData.video_url) {
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

                    if (akoolData.status === 'failed' || akoolData.status === 'error') {
                        jobs.set(jobId, {
                            ...job,
                            status: 'failed',
                            error: akoolData.error || 'Video generation failed'
                        });

                        return res.json({
                            status: 'failed',
                            error: akoolData.error || 'Video generation failed'
                        });
                    }

                    return res.json({
                        status: 'processing',
                        progress: akoolData.progress || null
                    });
                }
            } catch (akoolError) {
                console.error('Akool status check error:', akoolError.message);
            }
        }

        return res.json({
            status: 'processing'
        });

    } catch (error) {
        console.error('Status check error:', error.message);
        return res.status(500).json({ error: 'Failed to check status' });
    }
});

// Webhook endpoint for Akool callbacks
app.post('/api/webhook/akool', (req, res) => {
    try {
        const { id, status, video_url, error } = req.body;

        for (const [jobId, job] of jobs.entries()) {
            if (job.akoolJobId === id) {
                if (status === 'completed' && video_url) {
                    jobs.set(jobId, {
                        ...job,
                        status: 'completed',
                        videoUrl: video_url
                    });
                } else if (status === 'failed') {
                    jobs.set(jobId, {
                        ...job,
                        status: 'failed',
                        error: error || 'Video generation failed'
                    });
                }
                break;
            }
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error.message);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

// Cleanup old jobs every hour
setInterval(() => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    for (const [jobId, job] of jobs.entries()) {
        if (job.createdAt < oneHourAgo) {
            jobs.delete(jobId);
        }
    }
}, 60 * 60 * 1000);

// Start server
app.listen(PORT, () => {
    console.log(`ONRECORD API running on port ${PORT}`);
});

module.exports = app;
