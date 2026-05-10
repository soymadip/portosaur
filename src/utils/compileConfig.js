
// Import the config
const rawConfig = require('../../config.js');

function resolvePath(obj, path) {
  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = current[part];
  }

  return current;
}

function parseStringValue(value, config) {

  if (typeof value !== 'string') {
    return value;
  }

  // Find all ${...} references
  return value.replace(/\${([^}]+)}/g, (match, path) => {
    const resolvedValue = resolvePath(config, path);
    
    if (resolvedValue === undefined) {
      console.warn(`Warning: Could not resolve reference "${path}" in config value "${value}"`);
      return match;
    }
    
    if (typeof resolvedValue === 'string' && resolvedValue.includes('${')) {
      return parseStringValue(resolvedValue, config);
    }
    
    return resolvedValue;
  });
}


function parseConfigObject(obj, config) {

  if (Array.isArray(obj)) {
    return obj.map(item => parseConfigObject(item, config));
  }
  
  if (obj !== null && typeof obj === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = parseConfigObject(value, config);
    }
    return result;
  }
  
  if (typeof obj === 'string') {
    return parseStringValue(obj, config);
  }
  
  return obj;
}


function parseConfig(config) {

  const parsedConfig = JSON.parse(JSON.stringify(config));
  return parseConfigObject(parsedConfig, config);
}

// Parse the raw config
const parsedExports = {};
for (const key in rawConfig) {
  parsedExports[key] = parseConfig(rawConfig[key]);
}

module.exports = {
    ...parsedExports,
    parseConfig,
    parseStringValue,
    resolvePath,
}