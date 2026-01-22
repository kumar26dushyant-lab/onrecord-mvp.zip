import axios from "axios";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method === "GET") {
    return res.status(200).json({ status: "ok" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { text } = req.body || {};
    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    const clientId = process.env.AKOOL_CLIENT_ID;
    const clientSecret = process.env.AKOOL_CLIENT_SECRET;
    const avatarId = process.env.AKOOL_AVATAR_ID;

    if (!clientId || !clientSecret || !avatarId) {
      return res.status(500).json({ error: "Akool env vars missing" });
    }

    /* ===============================
       1️⃣ GET ACCESS TOKEN
    =============================== */
    const tokenRes = await axios.post(
      "https://api.akool.com/oauth/token",
      {
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials"
      }
    );

    const accessToken = tokenRes.data.access_token;
    if (!accessToken) {
      return res.status(500).json({ error: "Failed to obtain access token" });
    }

    /* ===============================
       2️⃣ CREATE VIDEO
    =============================== */
    const videoRes = await axios.post(
      "https://api.akool.com/api/open/v1/video/create",
      {
        avatar_id: avatarId,
        text,
        language: "en"
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    const data = videoRes.data?.data;

    if (!data?.task_id && !data?.video_url) {
      return res.status(500).json({
        error: "Akool response missing task_id/video_url",
        raw: videoRes.data
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
