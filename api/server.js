// server.js
import express from "express";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.post("/api/render", async (req, res) => {
  let browser;
  try {
    const { html, options = {} } = req.body;
    if (!html) {
      return res.status(400).json({ error: 'Missing "html" in request body' });
    }

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    await page.setViewport({
      width: options.viewport?.width || 1280,
      height: options.viewport?.height || 800,
      deviceScaleFactor: 1,
    });

    await page.setContent(html, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    const data = await page.evaluate(() => {
      function extract(el, depth = 0) {
        if (depth > 6) return null;
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        if (rect.width < 2 || rect.height < 2 || style.display === "none") return null;
        const tag = el.tagName.toLowerCase();
        if (["script","noscript","meta","link","style"].includes(tag)) return null;
        const text = el.innerText.trim().substring(0, 1000);
        const node = { tag, text, bounds: { x: rect.left, y: rect.top, width: rect.width, height: rect.height }, children: [] };
        for (const c of el.children) {
          const child = extract(c, depth + 1);
          if (child) node.children.push(child);
        }
        return node.text || node.children.length ? node : null;
      }
      return { elements: extract(document.body), viewport: { width: window.innerWidth, height: window.innerHeight } };
    });

    await browser.close();
    return res.json({ success: true, data });
  } catch (err) {
    if (browser) await browser.close();
    console.error("Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
