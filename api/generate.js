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
    const { text } = req.body || {};

    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Message text required" });
    }

    const apiKey = process.env.AKOOL_API_KEY;
    const avatarId = process.env.AKOOL_AVATAR_ID;

    if (!apiKey || !avatarId) {
      return res.status(500).json({
        error: "Missing AKOOL_API_KEY or AKOOL_AVATAR_ID"
      });
    }

    // ✅ CORRECT BASE + VERSION
    const akoolResponse = await axios.post(
      "https://api.akool.com/api/open/v1/avatar/text-to-video",
      {
        avatar_id: avatarId,
        text,
        language: "en",
      },
      {
        headers: {
          "X-API-KEY": apiKey,
          "Content-Type": "application/json"
        },
        timeout: 30000
      }
    );

    console.log("AKOOL RAW RESPONSE:", akoolResponse.data);

    const data = akoolResponse.data?.data;

    if (!data?.task_id && !data?.video_url) {
      return res.status(500).json({
        error: "Akool response missing task_id and video_url",
        akool: akoolResponse.data
      });
    }

    return res.status(200).json({
      success: true,
      jobId: data.task_id || null,
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
