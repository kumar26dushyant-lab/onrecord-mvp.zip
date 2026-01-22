import axios from "axios";

let cachedToken = null;
let tokenExpiry = 0;

async function getAkoolAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const tokenRes = await axios.post(
    "https://openapi.akool.com/api/open/v1/oauth/token",
    {
      client_id: process.env.AKOOL_CLIENT_ID,
      client_secret: process.env.AKOOL_CLIENT_SECRET,
      grant_type: "client_credentials"
    },
    {
      headers: { "Content-Type": "application/json" }
    }
  );

  if (!tokenRes.data?.access_token) {
    console.error("TOKEN RESPONSE:", tokenRes.data);
    throw new Error("Failed to obtain AKOOL access token");
  }

  cachedToken = tokenRes.data.access_token;
  tokenExpiry = Date.now() + (tokenRes.data.expires_in - 60) * 1000;

  return cachedToken;
}

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

    const accessToken = await getAkoolAccessToken();

    const response = await axios.post(
      "https://openapi.akool.com/api/open/v3/avatar/createVideoByText",
      {
        avatar_id: process.env.AKOOL_AVATAR_ID,
        text,
        voice_id: "en-US-GuyNeural"
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    const jobId = response?.data?.data?.id;

    if (!jobId) {
      console.error("AKOOL RAW RESPONSE:", response.data);
      return res.status(500).json({ error: "AKOOL did not return jobId" });
    }

    return res.status(200).json({
      success: true,
      jobId
    });

  } catch (err) {
    console.error("Generate crash:", err?.response?.data || err.message);
    return res.status(500).json({
      error: "Video generation failed",
      details: err?.response?.data || err.message
    });
  }
}
