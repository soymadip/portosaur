const fs = require('fs');
const path = require('path');

// AI generated

// Cache for CSS content and parsed variables
const cssCache = new Map();
const varCache = new Map();

// Debug flag - set to true to enable debug logs
const DEBUG = false;

function getCssVar(varName) {
  // Return cached value if exists
  if (varCache.has(varName)) {
    DEBUG && console.log(`[CSS-DEBUG] Using cached value for ${varName}: ${varCache.get(varName)}`);
    return varCache.get(varName);
  }

  DEBUG && console.log(`[CSS-DEBUG] Looking for CSS variable: ${varName}`);
  
  // Try to find variable in CSS files
  const cssFiles = [
    path.resolve(__dirname, '../css/custom.css'),
    path.resolve(__dirname, '../css/catppuccin.css')
  ];

  for (const cssPath of cssFiles) {
    try {
      DEBUG && console.log(`[CSS-DEBUG] Checking file: ${cssPath}`);
      
      if (!fs.existsSync(cssPath)) {
        DEBUG && console.log(`[CSS-DEBUG] File not found: ${cssPath}`);
        continue;
      }
      
      let cssContent = cssCache.get(cssPath);
      if (!cssContent) {
        cssContent = fs.readFileSync(cssPath, 'utf8');
        cssCache.set(cssPath, cssContent);
        DEBUG && console.log(`[CSS-DEBUG] Loaded CSS file: ${cssPath}`);
      }

      // Find all occurrences of the variable
      const regex = new RegExp(`${varName}:\\s*([^;]+);`, 'g');
      let lastValue = null;
      let match;
      let matchCount = 0;

      // Find all matches and keep the last one
      while ((match = regex.exec(cssContent)) !== null) {
        matchCount++;
        lastValue = match[1].replace(/!important/g, '').trim();
        DEBUG && console.log(`[CSS-DEBUG] Found match #${matchCount} for ${varName}: ${lastValue}`);
      }
      
      if (matchCount > 0) {
        DEBUG && console.log(`[CSS-DEBUG] Using last of ${matchCount} matches for ${varName}: ${lastValue}`);
      }

      // Process nested variables
      if (lastValue && lastValue.startsWith('var(')) {
        const nestedMatch = lastValue.match(/var\((--[^)]+)\)/);
        if (nestedMatch) {
          const nestedVar = nestedMatch[1];
          DEBUG && console.log(`[CSS-DEBUG] Found nested variable in ${varName}: ${nestedVar}`);
          
          try {
            const resolvedValue = getCssVar(nestedVar);
            DEBUG && console.log(`[CSS-DEBUG] Resolved nested ${nestedVar} to: ${resolvedValue}`);
            varCache.set(varName, resolvedValue);
            return resolvedValue;
          } catch (err) {
            DEBUG && console.log(`[CSS-DEBUG] Could not resolve nested variable: ${err.message}`);
            throw new Error(`Failed to resolve nested variable ${nestedVar} in ${varName}: ${err.message}`);
          }
        }
      }

      if (lastValue) {
        DEBUG && console.log(`[CSS-DEBUG] Caching and returning value for ${varName}: ${lastValue}`);
        varCache.set(varName, lastValue);
        return lastValue;
      }
    } catch (err) {
      DEBUG && console.log(`[CSS-DEBUG] Error processing ${cssPath}: ${err.message}`);
      if (err.message.includes('Failed to resolve nested variable')) {
        throw err; 
      }
    }
  }

  // Variable not found - throw error
  const errorMsg = `CSS variable ${varName} not found in any CSS files`;
  DEBUG && console.error(`[CSS-DEBUG] ${errorMsg}`);
  throw new Error(errorMsg);
}

module.exports = { getCssVar };