// api/render.js - New endpoint for professional rendering
const puppeteer = require('puppeteer-core');
const chromium = require('chrome-aws-lambda');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { html, options = {} } = req.body;

  if (!html) {
    return res.status(400).json({ error: 'HTML content is required' });
  }

  let browser = null;

  try {
    // Launch browser with optimized settings for Vercel
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();

    // Set viewport
    await page.setViewport({
      width: options.viewport?.width || 1280,
      height: options.viewport?.height || 800,
      deviceScaleFactor: 1,
    });

    // Enhanced HTML with normalization
    const enhancedHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { 
              box-sizing: border-box !important;
              -webkit-font-smoothing: antialiased !important;
              -moz-osx-font-smoothing: grayscale !important;
            }
            body { 
              margin: 0 !important;
              padding: 20px !important;
              font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
              line-height: 1.5 !important;
            }
            img { max-width: 100%; height: auto; }
            * { outline: none !important; }
          </style>
        </head>
        <body>
          ${html}
        </body>
      </html>
    `;

    await page.setContent(enhancedHTML, { waitUntil: 'networkidle0', timeout: 15000 });

    // Wait for fonts and images
    await page.waitForTimeout(2000);

    // Extract comprehensive element data
    const renderData = await page.evaluate(() => {
      function extractElementData(element, depth = 0) {
        if (depth > 8) return null;

        const rect = element.getBoundingClientRect();
        const computed = window.getComputedStyle(element);
        const tagName = element.tagName.toLowerCase();

        // Skip invisible or tiny elements
        if (rect.width <= 1 || rect.height <= 1 || computed.display === 'none' || computed.visibility === 'hidden') {
          return null;
        }

        const textContent = element.textContent?.trim() || '';
        
        const data = {
          tagName,
          textContent: textContent.substring(0, 2000),
          
          // Precise positioning and dimensions
          bounds: {
            x: Math.round(rect.left),
            y: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
          
          // Comprehensive styles
          styles: {
            // Typography
            fontFamily: computed.fontFamily,
            fontSize: parseFloat(computed.fontSize) || 14,
            fontWeight: computed.fontWeight,
            fontStyle: computed.fontStyle,
            lineHeight: computed.lineHeight,
            textAlign: computed.textAlign,
            textDecoration: computed.textDecoration,
            textTransform: computed.textTransform,
            letterSpacing: computed.letterSpacing,
            color: computed.color,
            
            // Background
            backgroundColor: computed.backgroundColor,
            backgroundImage: computed.backgroundImage,
            backgroundSize: computed.backgroundSize,
            backgroundPosition: computed.backgroundPosition,
            backgroundRepeat: computed.backgroundRepeat,
            
            // Box Model
            padding: {
              top: parseFloat(computed.paddingTop) || 0,
              right: parseFloat(computed.paddingRight) || 0,
              bottom: parseFloat(computed.paddingBottom) || 0,
              left: parseFloat(computed.paddingLeft) || 0,
            },
            margin: {
              top: parseFloat(computed.marginTop) || 0,
              right: parseFloat(computed.marginRight) || 0,
              bottom: parseFloat(computed.marginBottom) || 0,
              left: parseFloat(computed.marginLeft) || 0,
            },
            
            // Border
            borderTopWidth: parseFloat(computed.borderTopWidth) || 0,
            borderRightWidth: parseFloat(computed.borderRightWidth) || 0,
            borderBottomWidth: parseFloat(computed.borderBottomWidth) || 0,
            borderLeftWidth: parseFloat(computed.borderLeftWidth) || 0,
            borderTopColor: computed.borderTopColor,
            borderRightColor: computed.borderRightColor,
            borderBottomColor: computed.borderBottomColor,
            borderLeftColor: computed.borderLeftColor,
            borderStyle: computed.borderStyle,
            borderTopLeftRadius: parseFloat(computed.borderTopLeftRadius) || 0,
            borderTopRightRadius: parseFloat(computed.borderTopRightRadius) || 0,
            borderBottomLeftRadius: parseFloat(computed.borderBottomLeftRadius) || 0,
            borderBottomRightRadius: parseFloat(computed.borderBottomRightRadius) || 0,
            
            // Layout
            display: computed.display,
            position: computed.position,
            top: computed.top,
            right: computed.right,
            bottom: computed.bottom,
            left: computed.left,
            zIndex: computed.zIndex,
            
            // Flexbox
            flexDirection: computed.flexDirection,
            justifyContent: computed.justifyContent,
            alignItems: computed.alignItems,
            flexWrap: computed.flexWrap,
            gap: computed.gap,
            
            // Effects
            boxShadow: computed.boxShadow,
            opacity: parseFloat(computed.opacity) || 1,
            transform: computed.transform,
            filter: computed.filter,
            
            // Overflow
            overflow: computed.overflow,
            overflowX: computed.overflowX,
            overflowY: computed.overflowY,
          },
          
          // Attributes
          attributes: {
            id: element.id,
            className: element.className,
            src: element.getAttribute('src'),
            alt: element.getAttribute('alt'),
            href: element.getAttribute('href'),
            type: element.getAttribute('type'),
            placeholder: element.getAttribute('placeholder'),
          },
          
          // Element-specific data
          innerHTML: element.innerHTML?.substring(0, 1000) || '',
          
          children: []
        };

        // Process children
        Array.from(element.children).forEach(child => {
          const childData = extractElementData(child, depth + 1);
          if (childData) {
            data.children.push(childData);
          }
        });

        return data;
      }

      const bodyData = extractElementData(document.body);
      
      return {
        elements: bodyData,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        totalElements: document.querySelectorAll('*').length,
      };
    });

    // Capture screenshot for reference
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: true,
      omitBackground: false,
    });

    await browser.close();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    return res.status(200).json({
      success: true,
      data: renderData,
      screenshot: screenshot.toString('base64'),
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Rendering error:', error);
    
    if (browser) {
      await browser.close();
    }

    return res.status(500).json({
      error: 'Rendering failed',
      message: error.message,
    });
  }
}
