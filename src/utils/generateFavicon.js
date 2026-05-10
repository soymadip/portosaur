const fs = require('fs');
const path = require('path');

const { favicons } = require('favicons');
const { downloadImage } = require('./imageDownloader');
const { reshapeImage } = require('./imageProcessor');
const { getCssVar } = require('./cssUtils');
const { extractSvg } = require('./iconExtractor');

function createDirectoryIfNotExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    return true;
  }
  return false;
}

function cleanupFile(filePath) {
  if (fs.existsSync(filePath)) {
    try { 
      fs.unlinkSync(filePath); 
      return true;
    } catch (e) {
      console.warn(`[WARNING] Failed to clean up file ${filePath}:`, e.message);
    }
  }
  return false;
}

function processManifest(manifestFile, outputDir, appVersion) {
  try {
    const manifest = JSON.parse(manifestFile.contents);
    manifest.version = appVersion;
    
    fs.writeFileSync(
      path.join(outputDir, manifestFile.name), 
      JSON.stringify(manifest, null, 2)
    );
    return true;
  } catch (err) {
    console.error('[ERROR] Failed to process manifest:', err.message);
    fs.writeFileSync(path.join(outputDir, manifestFile.name), manifestFile.contents);
    return false;
  }
}

async function generateFavicons(context, options = {}) {
  console.log('\n[INFO] Generating favicons...');
  
  const {siteConfig} = context;
  const profilePicUrl = options.imagePath || siteConfig.customFields.heroSection.profilePic;
  const appVersion = siteConfig.customFields.version || '1.0';
  const circular = options.circular !== false;
  const shape = options.shape || 'circle';
  
  const staticBaseDir = path.resolve(context.siteDir, 'static');
  const imgDir = path.join(staticBaseDir, 'img', 'svg');
  const imgStaticPath = '/img/svg'; 
  const outputDir = path.join(staticBaseDir, options.outputPath || 'favicon');
  
  const tempDir = path.resolve(context.siteDir);
  const reshapedImagePath = path.join(tempDir, 'temp_reshaped_pic.png');
  
  const tempFiles = [];
  
  try {
    const iconColor = { color: getCssVar('--ifm-color-primary') };
    const iconsToGenerate = ['note', 'blog'];
    
    for (const icon of iconsToGenerate) {
      await extractSvg(icon, imgDir, iconColor);
    }

    const configuration = {
      path: `/${options.outputPath || 'favicon'}/`,
      appName: siteConfig.title || 'Portfolio',
      appDescription: siteConfig.tagline || 'Portfolio',
      background: getCssVar('--ifm-background-color'),
      theme_color: getCssVar('--ifm-color-primary'),
      appleStatusBarStyle: 'black-translucent',
      display: 'standalone',
      scope: '/',
      start_url: '/',
      version: appVersion,
      orientation: 'natural',
      logging: false,
      loadManifestWithCredentials: true,
      manifestMaskable: true,
      icons: {
        android: {
          offset: 0,
          background: false,
          mask: true,
          overlayGlow: false,
          androidPlayStore: true,
        },
        favicons: true,
        appleIcon: true,
        appleStartup: false,
        windows: false,
        yandex: false,
      },
      shortcuts: [
        {
          name: "Notes",
          short_name: "Notes",
          description: "View my collection of notes",
          url: "/notes",
          icons: [
            { 
              src: `${imgStaticPath}/icon-note.svg`,
              sizes: "any",
              type: "image/svg+xml",
              purpose: "any" 
            },
            { 
              src: "/img/project-blank.png", 
              sizes: "192x192", 
              type: "image/png",
              purpose: "any"
            }
          ]
        },
        {
          name: "Blog",
          short_name: "Blog",
          description: "Read my latest blog posts",
          url: "/blog",
          icons: [
            { 
              src: `${imgStaticPath}/icon-blog.svg`,
              sizes: "any",
              type: "image/svg+xml",
              purpose: "any" 
            },
            { 
              src: "/favicon/android-chrome-192x192.png", 
              sizes: "192x192", 
              type: "image/png",
              purpose: "any"
            }
          ]
        }
      ]
    };
    
    const downloadedImage = await downloadImage(profilePicUrl, context.siteDir, 'temp_profile_pic.png');

    tempFiles.push(downloadedImage);
    
    let finalImagePath = downloadedImage;
    if (circular) {
      finalImagePath = await reshapeImage(downloadedImage, reshapedImagePath, shape);
      tempFiles.push(finalImagePath);
      cleanupFile(downloadedImage);
    }
    
    createDirectoryIfNotExists(outputDir);
    
    console.log(`[INFO] Generating favicon assets from ${finalImagePath}`);
    const response = await favicons(finalImagePath, configuration);
    
    let imageCount = 0, fileCount = 0;
    
    if (Array.isArray(response.images) && response.images.length > 0) {
      for (const image of response.images) {
        if (!image || !image.name || !image.contents) continue;
        
        try {
          fs.writeFileSync(path.join(outputDir, image.name), image.contents);
          imageCount++;
        } catch (err) {
          console.error(`[ERROR] Failed to write image ${image.name}:`, err.message);
        }
      }
    }
    
    if (Array.isArray(response.files) && response.files.length > 0) {
      for (const file of response.files) {
        if (!file || !file.name || !file.contents) continue;
        
        try {
          if (file.name.includes('manifest')) {
            processManifest(file, outputDir, appVersion);
          } else {
            fs.writeFileSync(path.join(outputDir, file.name), file.contents);
          }
          fileCount++;
        } catch (err) {
          console.error(`[ERROR] Failed to write file ${file.name}:`, err.message);
        }
      }
    }
    
    tempFiles.forEach(cleanupFile);
    
    console.log(`[SUCCESS] Generated ${imageCount} favicon images and ${fileCount} support files\n`);
    return true;
    
  } catch (error) {
    console.error('[ERROR] Error generating favicons:', error.message);
    tempFiles.forEach(cleanupFile);
    throw error;
  }
}

module.exports = {
  generateFavicons,
  default: function(context, options = {}) {
    const {
      imagePath = null,
      outputPath = 'favicon',
      circular = true,
      shape = 'circle',
      generateOnDev = true,
    } = options;

    return {
      name: 'favicon-generator',
      
      async loadContent() {
        const shouldGenerate = 
          process.env.NODE_ENV === 'production' || 
          process.env.GENERATE_FAVICONS || 
          generateOnDev;
          
        if (shouldGenerate) {
          try {
            await generateFavicons(context, {
              imagePath,
              outputPath,
              circular,
              shape,
            });
          } catch (error) {
            console.error('[FATAL] Favicon generation failed:', error);
            process.exit(1);
          }
        }
      }
    };
  }
};

if (require.main === module) {
  const siteDir = path.resolve(__dirname, '../..');
  const siteConfig = require('../../docusaurus.config.js').default;
  
  generateFavicons({
    siteDir,
    siteConfig
  }).catch(error => {
    console.error('[FATAL] Error in CLI mode:', error);
    process.exit(1);
  });
}
