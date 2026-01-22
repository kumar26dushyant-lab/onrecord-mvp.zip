import axios from "axios";

export default async function handler(req, res) {
  // Always respond with JSON
  res.setHeader("Content-Type", "application/json");

  // -------------------------------
  // Health check (GET)
  // -------------------------------
  if (req.method === "GET") {
    return res.status(200).json({
      status: "ok",
      service: "onrecord-generate"
    });
  }

  // -------------------------------
  // Only allow POST
  // -------------------------------
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { text, tone = "serious", paid = false } = req.body || {};

    // -------------------------------
    // Validate input
    // -------------------------------
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({
        error: "Message text is required"
      });
    }

    // -------------------------------
    // Validate env vars
    // -------------------------------
    if (!process.env.AKOOL_API_KEY) {
      return res.status(500).json({
        error: "AKOOL_API_KEY missing"
      });
    }

    if (!process.env.AKOOL_AVATAR_ID) {
      return res.status(500).json({
        error: "AKOOL_AVATAR_ID missing"
      });
    }

    // -------------------------------
    // Call Akool API
    // -------------------------------
    const akoolRes = await axios.post(
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

    // 🔍 LOG RAW RESPONSE (important during MVP)
    console.log("AKOOL RESPONSE:", JSON.stringify(akoolRes.data));

    const data = akoolRes.data?.data || {};

    // -------------------------------
    // 🔑 CONTRACT: return ONE of these
    // -------------------------------

    // Case 1: Akool already returned a video
    if (data.video_url) {
      return res.status(200).json({
        videoUrl: data.video_url
      });
    }

    // Case 2: Akool returned async job
    if (data.id) {
      return res.status(200).json({
        jobId: data.id
      });
    }

    // -------------------------------
    // If neither present → backend bug
    // -------------------------------
    return res.status(500).json({
      error: "Akool response missing jobId and videoUrl",
      raw: data
    });

  } catch (err) {
    console.error(
      "Generate crashed:",
      err?.response?.data || err.message
    );

    return res.status(500).json({
      error: "Video generation failed",
      details: err?.response?.data || err.message
    });
  }
}
