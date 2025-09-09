import fetch from "node-fetch";

export default async function fetchHandler(req, res) {
  try {
    const targetUrl = req.query.url;
    if (!targetUrl) {
      return res.status(400).json({ error: "Missing url parameter" });
    }

    const response = await fetch(targetUrl);
    const html = await response.text();

    res.json({ success: true, html });
  } catch (err) {
    console.error("Fetch error:", err);
    res.status(500).json({ error: err.message });
  }
}
