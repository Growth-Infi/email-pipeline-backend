import axios from "axios";

const BRANDNAV_URL = process.env.BRANDNAV_URL;
const API_KEY = process.env.BRANDNAV_API_KEY;

async function startVerification(emails, webhookUrl) {
  const res = await axios.post(
    `${BRANDNAV_URL}/api/verifier/v1/verify`,
    {
      emails,
      responseUrl: webhookUrl,
    },
    {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
    },
  );

  return res.data;
}
export default {
  startVerification,
};
