export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Get URL from query parameter
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        error: 'Missing required parameter: url',
        message: 'Please provide a URL parameter in your request'
      });
    }

    // Validate URL format
    let targetUrl;
    try {
      targetUrl = new URL(url);
    } catch (error) {
      return res.status(400).json({
        error: 'Invalid URL format',
        message: 'The provided URL is not valid'
      });
    }

    // Fetch the target URL
    const response = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Figma-Proxy/1.0)',
        'Accept': '*/*',
        ...req.headers.authorization && { 'Authorization': req.headers.authorization }
      },
      ...(req.method !== 'GET' && req.method !== 'HEAD' && { body: JSON.stringify(req.body) })
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `HTTP ${response.status}`,
        message: response.statusText || 'Request failed'
      });
    }

    // Get content type from response
    const contentType = response.headers.get('content-type') || 'text/plain';

    // Set appropriate headers
    res.setHeader('Content-Type', contentType);

    // Handle different content types
    if (contentType.includes('application/json')) {
      // JSON response
      const data = await response.json();
      return res.status(200).json(data);
    } else if (contentType.includes('text/') || contentType.includes('application/xml')) {
      // Text/HTML/XML response
      const text = await response.text();
      return res.status(200).send(text);
    } else if (contentType.includes('image/') || contentType.includes('application/octet-stream')) {
      // Binary response (images, etc.)
      const buffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);
      return res.status(200).send(Buffer.from(uint8Array));
    } else {
      // Default to text
      const text = await response.text();
      return res.status(200).send(text);
    }

  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({
      error: 'Proxy request failed',
      message: error.message || 'An unexpected error occurred'
    });
  }
}