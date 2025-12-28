/**
 * Crops a specific cell from a 3x3 grid image.
 * @param base64Image The full master grid image
 * @param index The index of the cell (0-8)
 * @returns Promise resolving to the cropped base64 image
 */
export const cropGridCell = (base64Image: string, index: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }
  
        // Calculate cell dimensions (assuming 3x3 grid)
        const cellWidth = Math.floor(img.width / 3);
        const cellHeight = Math.floor(img.height / 3);
  
        // Calculate coordinates based on index (0-8)
        // Row = floor(index / 3), Col = index % 3
        const col = index % 3;
        const row = Math.floor(index / 3);
  
        const sx = col * cellWidth;
        const sy = row * cellHeight;
  
        // Set canvas to cell size
        canvas.width = cellWidth;
        canvas.height = cellHeight;
  
        // Draw the specific slice
        ctx.drawImage(
          img,
          sx, sy, cellWidth, cellHeight, // Source crop
          0, 0, cellWidth, cellHeight   // Dest pos
        );
  
        // Return as base64
        resolve(canvas.toDataURL('image/png'));
      };
      
      img.onerror = (e) => reject(e);
      img.src = base64Image;
    });
  };