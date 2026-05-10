const fs = require('fs');
const path = require('path');

let cachedVersion = null;

function appVersion() {

  if (cachedVersion) {
    return cachedVersion;
  }

  try {
    const pkgPath = path.resolve(__dirname, '../../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

    cachedVersion = pkg.version || '0.0.0';
  } catch (err) {

    cachedVersion = '0.0.0';
    console.warn('Could not read package.json version:', err.message);
  }

  console.info('\n[INFO] App version:', cachedVersion);
  return cachedVersion;
}

module.exports = { appVersion };
