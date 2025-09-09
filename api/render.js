// api/render.js
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let browser = null;
  try {
    const { html, options = {} } = req.body;
    if (!html) {
      return res.status(400).json({ error: 'Missing "html" in request body' });
    }

    // Launch headless browser
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

    // Block scripts and styles
    await page.setRequestInterception(true);
    page.on('request', request => {
      const type = request.resourceType();
      if (type === 'script' || type === 'stylesheet') {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Inject HTML
    const enhancedHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <style>
            * { box-sizing: border-box!important; }
            body { margin:0!important; padding:20px!important; font-family:system-ui,sans-serif!important; }
            script, noscript { display: none!important; }
          </style>
        </head>
        <body>${html}</body>
      </html>
    `;
    await page.setContent(enhancedHTML, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Extract visible element data
    const data = await page.evaluate(() => {
      function extract(el, depth = 0) {
        if (depth > 6) return null;
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        if (rect.width < 2 || rect.height < 2 || style.display === 'none' || style.visibility === 'hidden') return null;
        const tag = el.tagName.toLowerCase();
        if (['script','noscript','meta','link','style'].includes(tag)) return null;
        let text = el.innerText?.trim() || '';
        if (/function|document\.|window\./.test(text)) text = '';
        const node = {
          tag,
          text: text.slice(0, 1000),
          bounds: { x: Math.round(rect.left), y: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) },
          styles: {
            fontFamily: style.fontFamily,
            fontSize: parseFloat(style.fontSize) || 14,
            color: style.color,
            backgroundColor: style.backgroundColor,
            borderRadius: parseFloat(style.borderRadius) || 0,
            padding: {
              top: parseFloat(style.paddingTop)||0,
              right: parseFloat(style.paddingRight)||0,
              bottom: parseFloat(style.paddingBottom)||0,
              left: parseFloat(style.paddingLeft)||0
            },
            margin: {
              top: parseFloat(style.marginTop)||0,
              right: parseFloat(style.marginRight)||0,
              bottom: parseFloat(style.marginBottom)||0,
              left: parseFloat(style.marginLeft)||0
            }
          },
          children: []
        };
        for (const child of el.children) {
          const c = extract(child, depth+1);
          if (c) node.children.push(c);
        }
        return (node.text || node.children.length>0 || ['img','button','input','a'].includes(tag)) ? node : null;
      }
      const root = extract(document.body);
      return { elements: root, viewport: { width: window.innerWidth, height: window.innerHeight } };
    });

    await browser.close();
    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('Render error:', err);
    if (browser) await browser.close();
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
}
    });

    console.log('Browser launched successfully');

    const page = await browser.newPage();

    // Set viewport
    await page.setViewport({
      width: options.viewport?.width || 1280,
      height: options.viewport?.height || 800,
      deviceScaleFactor: 1,
    });

    console.log('Viewport set');

    // Block JavaScript and ads for faster loading
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (resourceType === 'script' || resourceType === 'stylesheet' || resourceType === 'image') {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Enhanced HTML with script blocking
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
            }
            body { 
              margin: 0 !important;
              padding: 20px !important;
              font-family: system-ui, sans-serif !important;
              line-height: 1.5 !important;
            }
            script { display: none !important; }
            noscript { display: none !important; }
          </style>
        </head>
        <body>
          ${html}
        </body>
      </html>
    `;

    console.log('Setting content...');
    await page.setContent(enhancedHTML, { waitUntil: 'domcontentloaded', timeout: 10000 });
    
    console.log('Content set, waiting...');
    await page.waitForTimeout(2000);

    console.log('Extracting data...');

    // Extract element data with script filtering
    const renderData = await page.evaluate(() => {
      
      // Remove scripts first
      const scripts = document.querySelectorAll('script, noscript, style[data-href*="javascript"]');
      scripts.forEach(script => script.remove());
      
      function extractElementData(element, depth = 0) {
        if (depth > 6) return null;

        const rect = element.getBoundingClientRect();
        const computed = window.getComputedStyle(element);
        const tagName = element.tagName.toLowerCase();

        // Skip problematic elements
        if (['script', 'noscript', 'meta', 'link', 'style'].includes(tagName)) {
          return null;
        }

        // Skip invisible elements
        if (rect.width <= 1 || rect.height <= 1 || computed.display === 'none') {
          return null;
        }

        // Get clean text content
        let textContent = '';
        if (element.innerText) {
          textContent = element.innerText.trim();
        }

        // Skip JavaScript-like content
        if (textContent.includes('function') || textContent.includes('document.') || textContent.includes('window.')) {
          return null;
        }

        const data = {
          tagName,
          textContent: textContent.substring(0, 1000),
          
          bounds: {
            x: Math.round(rect.left),
            y: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
          
          styles: {
            fontFamily: computed.fontFamily,
            fontSize: parseFloat(computed.fontSize) || 14,
            fontWeight: computed.fontWeight,
            textAlign: computed.textAlign,
            color: computed.color,
            backgroundColor: computed.backgroundColor,
            borderRadius: parseFloat(computed.borderRadius) || 0,
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
          },
          
          attributes: {
            id: element.id,
            className: element.className,
            src: element.getAttribute('src'),
            alt: element.getAttribute('alt'),
            href: element.getAttribute('href'),
          },
          
          children: []
        };

        // Process children for meaningful elements
        if (element.children && (textContent || ['div', 'section', 'article', 'header', 'main'].includes(tagName))) {
          Array.from(element.children).forEach(child => {
            const childData = extractElementData(child, depth + 1);
            if (childData) {
              data.children.push(childData);
            }
          });
        }

        // Return only meaningful elements
        return (textContent || data.children.length > 0 || ['img', 'button', 'input'].includes(tagName)) ? data : null;
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

    console.log('Data extracted successfully');

    await browser.close();
    console.log('Browser closed');

    return res.status(200).json({
      success: true,
      data: renderData,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Rendering error:', error.message);
    
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error closing browser:', closeError.message);
      }
    }

    return res.status(500).json({
      error: 'Rendering failed',
      message: error.message,
    });
  }
}      <!DOCTYPE html>
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
            script { display: none !important; }
            noscript { display: none !important; }
          </style>
        </head>
        <body>
          ${html}
        </body>
      </html>
    `;

    await page.setContent(enhancedHTML, { waitUntil: 'networkidle0', timeout: 15000 });
    
    // Block JavaScript execution
    await page.setJavaScriptEnabled(false);
    
    // Wait for content to stabilize
    await page.waitForTimeout(3000);

    // Extract comprehensive element data with script filtering
    const renderData = await page.evaluate(() => {
      
      // Remove all script and noscript elements first
      function cleanScripts() {
        const scripts = document.querySelectorAll('script, noscript, style[data-href*="javascript"]');
        scripts.forEach(script => script.remove());
      }
      
      cleanScripts();
      
      function extractElementData(element, depth = 0) {
        if (depth > 8) return null;

        const rect = element.getBoundingClientRect();
        const computed = window.getComputedStyle(element);
        const tagName = element.tagName.toLowerCase();

        // Skip script tags, comments, and invisible elements
        if (['script', 'noscript', 'meta', 'link', 'style'].includes(tagName)) {
          return null;
        }

        // Skip elements with no dimensions or hidden
        if (rect.width <= 1 || rect.height <= 1 || computed.display === 'none' || computed.visibility === 'hidden') {
          return null;
        }

        // Get only visible text content (no scripts)
        let textContent = '';
        if (element.childNodes) {
          Array.from(element.childNodes).forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
              textContent += node.textContent;
            }
          });
        }
        textContent = textContent.trim();

        // Alternative: use innerText which respects CSS styling
        if (!textContent && element.innerText) {
          textContent = element.innerText.trim();
        }

        const data = {
          tagName,
          textContent: textContent.substring(0, 2000),
          
          bounds: {
            x: Math.round(rect.left),
            y: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
          
          styles: {
            // Typography
            fontFamily: computed.fontFamily,
            fontSize: parseFloat(computed.fontSize) || 14,
            fontWeight: computed.fontWeight,
            fontStyle: computed.fontStyle,
            lineHeight: computed.lineHeight,
            textAlign: computed.textAlign,
            textDecoration: computed.textDecoration,
            color: computed.color,
            
            // Background
            backgroundColor: computed.backgroundColor,
            backgroundImage: computed.backgroundImage !== 'none' ? computed.backgroundImage : '',
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
            borderStyle: computed.borderStyle,
            borderTopLeftRadius: parseFloat(computed.borderTopLeftRadius) || 0,
            borderTopRightRadius: parseFloat(computed.borderTopRightRadius) || 0,
            borderBottomLeftRadius: parseFloat(computed.borderBottomLeftRadius) || 0,
            borderBottomRightRadius: parseFloat(computed.borderBottomRightRadius) || 0,
            
            // Layout
            display: computed.display,
            position: computed.position,
            flexDirection: computed.flexDirection,
            justifyContent: computed.justifyContent,
            alignItems: computed.alignItems,
            
            // Effects
            boxShadow: computed.boxShadow !== 'none' ? computed.boxShadow : '',
            opacity: parseFloat(computed.opacity) || 1,
            transform: computed.transform !== 'none' ? computed.transform : '',
          },
          
          attributes: {
            id: element.id,
            className: element.className,
            src: element.getAttribute('src'),
            alt: element.getAttribute('alt'),
            href: element.getAttribute('href'),
            type: element.getAttribute('type'),
            placeholder: element.getAttribute('placeholder'),
          },
          
          children: []
        };

        // Only process children if current element has meaningful content or structure
        if (element.children && (textContent || ['div', 'section', 'article', 'header', 'main', 'nav', 'footer'].includes(tagName))) {
          Array.from(element.children).forEach(child => {
            const childData = extractElementData(child, depth + 1);
            if (childData) {
              data.children.push(childData);
            }
          });
        }

        // Only return elements with content or meaningful structure
        return (textContent || data.children.length > 0 || ['img', 'button', 'input', 'a'].includes(tagName)) ? data : null;
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

    await browser.close();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    return res.status(200).json({
      success: true,
      data: renderData,
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
}    // Enhanced HTML with normalization
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
