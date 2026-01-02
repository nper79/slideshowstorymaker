
/**
 * Splits a Standard 4:3 input image into two Vertical 9:16 frames.
 * The function intelligently crops the center of the left half and the center of the right half.
 */
export const splitCombinedKeyframes = (base64Image: string): Promise<{ start: string, end: string }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error("Canvas context failed"));

        const imgWidth = img.width;
        const imgHeight = img.height;

        // Target output dimensions (9:16 vertical)
        // We set the target height to the full image height for max resolution.
        const targetHeight = imgHeight;
        const targetWidth = (9 / 16) * targetHeight;

        const crop = (isRight: boolean): string => {
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          
          // Logic: The original image is treated as two halves.
          // Left half center = width * 0.25
          // Right half center = width * 0.75
          const centerX = isRight ? (imgWidth * 0.75) : (imgWidth * 0.25);
          
          // Calculate start X (Left edge of the crop box)
          const startX = centerX - (targetWidth / 2);

          // Bound checking (clipping safety)
          // Ensure we don't try to draw from negative X or past the image width
          const safeStartX = Math.max(0, Math.min(startX, imgWidth - targetWidth));

          ctx.clearRect(0, 0, targetWidth, targetHeight);
          ctx.drawImage(
            img,
            safeStartX, 0, targetWidth, targetHeight, // Source
            0, 0, targetWidth, targetHeight           // Destination
          );
          return canvas.toDataURL('image/png');
        };

        resolve({
          start: crop(false), // Left side (Zoom/Close-up)
          end: crop(true)     // Right side (Full Body/Wide)
        });
      };
      img.onerror = reject;
      img.src = base64Image;
    });
};

export const cropGridCell = (base64Image: string, index: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error("Could not get canvas context"));
        const cellWidth = img.width / 3;
        const cellHeight = img.height / 3;
        const col = index % 3;
        const row = Math.floor(index / 3);
        const sx = col * cellWidth;
        const sy = row * cellHeight;
        canvas.width = cellWidth;
        canvas.height = cellHeight;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(img, sx, sy, cellWidth, cellHeight, 0, 0, cellWidth, cellHeight);
        resolve(canvas.toDataURL('image/png', 1.0));
      };
      img.onerror = (e) => reject(e);
      img.src = base64Image;
    });
};
