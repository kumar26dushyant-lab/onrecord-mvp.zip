import axios from "axios";

export default async function handler(req, res) {
  // Always return JSON
  res.setHeader("Content-Type", "application/json");

  // ✅ Handle GET (health / sanity check)
  if (req.method === "GET") {
    return res.status(200).json({
      status: "ok",
      message: "ONRECORD generate endpoint alive"
    });
  }

  // ❌ Block anything except POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { text, tone = "serious", paid = false } = req.body || {};

    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Message text required" });
    }

    if (!process.env.AKOOL_API_KEY) {
      return res.status(500).json({ error: "AKOOL_API_KEY missing" });
    }

    const response = await axios.post(
      "https://openapi.akool.com/api/open/v3/avatar/createVideoByText",
      {
        avatar_id: process.env.AKOOL_AVATAR_ID,
        text,
        voice_id: "en-US-GuyNeural"
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.AKOOL_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    return res.status(200).json({
      success: true,
      jobId: response.data?.data?.id || null,
      videoUrl: response.data?.data?.video_url || null
    });

  } catch (err) {
    console.error("Generate crash:", err?.response?.data || err.message);

    return res.status(500).json({
      error: "Video generation failed",
      details: err?.response?.data || err.message
    });
  }
}
