const fs = require('fs');
const path = require('path');
const https = require('https');


// AI GENERATED - Partially

/**
 * Downloads or copies an image from a URL or local file path to a specified directory
 * 
 * @param {string} source - The URL or local file path of the image
 * @param {string} outputDir - The directory where the image should be saved
 * @param {string} [filename='temp_image.png'] - The filename to use for the saved image
 * @returns {Promise<string>} - A promise that resolves with the path to the saved image
 */
async function downloadImage(source, outputDir, filename = 'temp_image.png') {

  const tmpImagePath = path.resolve(outputDir, filename);
  
  // Check if the source is a local file path or a URL
  const isUrl = source.startsWith('http://') || source.startsWith('https://');
  
  if (isUrl) {
    console.log(`[INFO] Downloading remote image from: ${source}`);
    
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(tmpImagePath);
      
      https.get(source, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download image, status code: ${response.statusCode}`));
          return;
        }
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          resolve(tmpImagePath);
        });
        
        file.on('error', (err) => {
          fs.unlink(tmpImagePath, () => {});
          reject(err);
        });
      }).on('error', (err) => {
        fs.unlink(tmpImagePath, () => {});
        reject(err);
      });
    });
  } else {

    // local file path
    console.log(`[INFO] Copying local image from: ${source}`);
    
    return new Promise((resolve, reject) => {

      // Check if source file exists
      if (!fs.existsSync(source)) {
        reject(new Error(`Source file does not exist: ${source}`));
        return;
      }
      
      // Create a read stream from the source file
      const readStream = fs.createReadStream(source);
      const writeStream = fs.createWriteStream(tmpImagePath);
      
      // Pipe the read stream to the write stream
      readStream.pipe(writeStream);
      
      writeStream.on('finish', () => {
        resolve(tmpImagePath);
      });
      
      writeStream.on('error', (err) => {
        fs.unlink(tmpImagePath, () => {});
        reject(err);
      });
      
      readStream.on('error', (err) => {
        fs.unlink(tmpImagePath, () => {});
        reject(err);
      });
    });
  }
}

module.exports = { downloadImage };
