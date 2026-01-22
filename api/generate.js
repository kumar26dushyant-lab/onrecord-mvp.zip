import axios from "axios";

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { text, tone = "serious", paid = false } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    const AKOOL_API_KEY = process.env.AKOOL_API_KEY;
    const AVATAR_ID =
      process.env.AKOOL_AVATAR_ID || "dvp_Tristan_cloth2_1080P";

    if (!AKOOL_API_KEY) {
      return res.status(500).json({ error: "AKOOL_API_KEY missing" });
    }

    const response = await axios.post(
      "https://openapi.akool.com/api/open/v3/avatar/createVideoByText",
      {
        avatar_id: AVATAR_ID,
        text,
        voice_id: "en-US-GuyNeural",
      },
      {
        headers: {
          Authorization: `Bearer ${AKOOL_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return res.status(200).json({
      success: true,
      data: response.data,
    });

  } catch (err) {
    console.error("AKOOL ERROR:", err.response?.data || err.message);
    return res.status(500).json({
      error: "Video generation failed",
      details: err.response?.data || err.message,
    });
  }
}
