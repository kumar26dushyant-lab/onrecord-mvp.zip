import axios from "axios";

export default async function handler(req, res) {
  // Allow only POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { text, tone = "serious", paid = false } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: "Text is required" });
    }

    if (!process.env.AKOOL_API_KEY) {
      return res.status(500).json({ error: "AKOOL_API_KEY missing" });
    }

    const AKOOL_API_URL = "https://openapi.akool.com/api/open/v3";

    const response = await axios.post(
      `${AKOOL_API_URL}/avatar/createVideoByText`,
      {
        avatar_id: process.env.AKOOL_AVATAR_ID || "ai_139_realisticbg",
        text: `This message is being sent ONRECORD.\n\n${text}\n\nThank you.`,
        voice_id: "en-US-GuyNeural",
        speed: 1,
        pitch: 0,
        watermark: paid
          ? null
          : {
              text: "ONRECORD - This message is on record",
              position: "bottom-left",
              font_size: 14,
              opacity: 0.8,
            },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.AKOOL_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 25000,
      }
    );

    const jobId =
      response.data?.data?.id || response.data?.data?._id;

    if (!jobId) {
      return res.status(500).json({ error: "Akool did not return job ID" });
    }

    return res.json({
      success: true,
      jobId,
    });
  } catch (err) {
    console.error("GENERATION FAILED:", err?.response?.data || err.message);
    return res.status(500).json({
      error: "Video generation failed",
      details: err?.response?.data || err.message,
    });
  }
}
