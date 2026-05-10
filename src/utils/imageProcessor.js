const sharp = require('sharp');

// AI GENERATED

/**
 * Reshapes an image to various predefined shapes
 * 
 * @param {string} imagePath - Path to the input image
 * @param {string} outputPath - Path to save the processed image
 * @param {string} [shape='circle'] - Shape to apply ('circle', 'square', 'rounded', 'hexagon', 'shield')
 * @param {number} [roundedCornerRadius=50] - Corner radius for rounded shape (percentage)
 * @returns {Promise<string>} - A promise that resolves with the path to the processed image
 */
async function reshapeImage(imagePath, outputPath, shape = 'circle', roundedCornerRadius = 50) {
  console.log(`[INFO] Processing image to ${shape} shape...`);
  
  try {
    // Get image dimensions
    const metadata = await sharp(imagePath).metadata();
    const size = Math.min(metadata.width, metadata.height);
    
    let shapeMask;
    
    switch (shape.toLowerCase()) {
      case 'circle':
        shapeMask = Buffer.from(
          `<svg><circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="white"/></svg>`
        );
        break;
        
      case 'square':
        // No mask needed for square, just resize to equal width/height
        await sharp(imagePath)
          .resize(size, size, { fit: 'cover' })
          .toFile(outputPath);
        return outputPath;
        
      case 'rounded':
        // Convert percentage to actual pixels (e.g., 50% becomes size/4)
        const radius = Math.min(100, Math.max(0, roundedCornerRadius)) * size / 200;
        shapeMask = Buffer.from(
          `<svg><rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="white"/></svg>`
        );
        break;
        
      case 'hexagon':
        // Calculate hexagon points
        const centerX = size / 2;
        const centerY = size / 2;
        const hexRadius = size / 2;
        let points = '';
        for (let i = 0; i < 6; i++) {
          const angleDeg = 60 * i - 30;
          const angleRad = Math.PI / 180 * angleDeg;
          const x = centerX + hexRadius * Math.cos(angleRad);
          const y = centerY + hexRadius * Math.sin(angleRad);
          points += `${x},${y} `;
        }
        shapeMask = Buffer.from(
          `<svg><polygon points="${points}" fill="white"/></svg>`
        );
        break;
        
      case 'shield':
        const shieldWidth = size;
        const shieldHeight = size;
        const bottomCurve = size / 3;
        shapeMask = Buffer.from(
          `<svg>
            <path d="M ${shieldWidth/2},0
                     L ${shieldWidth},${shieldHeight/3}
                     C ${shieldWidth},${shieldHeight-bottomCurve} ${shieldWidth/2},${shieldHeight} ${shieldWidth/2},${shieldHeight}
                     C ${shieldWidth/2},${shieldHeight} 0,${shieldHeight-bottomCurve} 0,${shieldHeight/3}
                     L ${shieldWidth/2},0 Z" 
                  fill="white"/>
          </svg>`
        );
        break;
        
      default:
        // Default to circle if shape is not recognized
        console.warn(`Shape "${shape}" not recognized, defaulting to circle`);
        shapeMask = Buffer.from(
          `<svg><circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="white"/></svg>`
        );
    }
    
    // Apply the mask and save the final image
    await sharp(imagePath)
      .resize(size, size, { fit: 'cover' })
      .composite([
        {
          input: shapeMask,
          blend: 'dest-in'
        }
      ])
      .png()
      .toFile(outputPath);
      
    return outputPath;
  } catch (error) {
    console.error(`Error reshaping image to ${shape}:`, error);
    throw error;
  }
}

/**
 * Resizes an image while maintaining aspect ratio
 * 
 * @param {string} imagePath - Path to the input image
 * @param {string} outputPath - Path to save the processed image
 * @param {number} maxWidth - Maximum width of the output image
 * @param {number} maxHeight - Maximum height of the output image
 * @returns {Promise<string>} - A promise that resolves with the path to the processed image
 */
async function resizeImage(imagePath, outputPath, maxWidth, maxHeight) {
  console.log(`Resizing image to max ${maxWidth}x${maxHeight}...`);
  
  await sharp(imagePath)
    .resize(maxWidth, maxHeight, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .toFile(outputPath);
    
  return outputPath;
}



module.exports = {
    reshapeImage,
    resizeImage,
};
