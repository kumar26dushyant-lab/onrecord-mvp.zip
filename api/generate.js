import axios from "axios";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  // Health check
  if (req.method === "GET") {
    return res.status(200).json({
      status: "ok",
      message: "ONRECORD generate endpoint alive"
    });
  }

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

    if (!process.env.AKOOL_AVATAR_ID) {
      return res.status(500).json({ error: "AKOOL_AVATAR_ID missing" });
    }

    const akoolResponse = await axios.post(
      "https://openapi.akool.com/api/open/v3/avatar/createVideoByText",
      {
        avatar_id: process.env.AKOOL_AVATAR_ID,
        text,
        // Akool ignores tone for now — safe to keep
        voice_id: "en-US-GuyNeural"
      },
      {
        headers: {
          "X-API-KEY": process.env.AKOOL_API_KEY, // ✅ CORRECT
          "Content-Type": "application/json"
        },
        timeout: 30000
      }
    );

    const data = akoolResponse.data?.data || {};

    // 🔐 Validate Akool response strictly
    if (!data.id && !data.video_url) {
      console.error("AKOOL RAW RESPONSE:", akoolResponse.data);
      return res.status(500).json({
        error: "Akool response missing jobId and videoUrl",
        akool: akoolResponse.data
      });
    }

    return res.status(200).json({
      success: true,
      jobId: data.id || null,
      videoUrl: data.video_url || null
    });

  } catch (err) {
    console.error("Generate crash:", err?.response?.data || err.message);

    return res.status(500).json({
      error: "Video generation failed",
      details: err?.response?.data || err.message
    });
  }
}
