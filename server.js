import express from "express";
import cors from "cors";
import fetchHandler from "./api/fetch.js";
import renderHandler from "./api/render.js";

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));

// Routes
app.get("/api/fetch", fetchHandler);   // fetch HTML
app.post("/api/render", renderHandler); // parse HTML into layer tree

// Health check
app.get("/", (req, res) => {
  res.send("✅ Figma Proxy Server running. Use /api/fetch or /api/render");
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
