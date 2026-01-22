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

    const jobId = response?.data?.data?.id;
    const videoUrl = response?.data?.data?.video_url;

    if (!jobId && !videoUrl) {
      console.error("AKOOL RAW RESPONSE:", response.data);
      return res.status(500).json({
        error: "AKOOL did not return jobId or videoUrl"
      });
    }

    return res.status(200).json({
      success: true,
      jobId,
      videoUrl
    });

  } catch (err) {
    console.error("Generate crash:", err?.response?.data || err.message);
    return res.status(500).json({
      error: "Video generation failed",
      details: err?.response?.data || err.message
    });
  }
}
