
/**
 * Corta uma imagem quadrada (1x1) em dois frames verticais (9:16).
 * O lado esquerdo é o 'Start' e o lado direito é o 'End'.
 */
export const splitCombinedKeyframes = (base64Image: string): Promise<{ start: string, end: string }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error("Canvas context failed"));

        // Definimos o formato 9:16 baseado na altura da imagem original
        const targetHeight = img.height;
        const targetWidth = (9 / 16) * targetHeight;

        const crop = (isRight: boolean): string => {
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          
          // Calculamos o centro de cada metade
          const halfWidth = img.width / 2;
          const centerX = isRight ? (img.width * 0.75) : (img.width * 0.25);
          const sx = centerX - (targetWidth / 2);

          ctx.clearRect(0, 0, targetWidth, targetHeight);
          ctx.drawImage(
            img,
            sx, 0, targetWidth, targetHeight,
            0, 0, targetWidth, targetHeight
          );
          return canvas.toDataURL('image/png');
        };

        resolve({
          start: crop(false),
          end: crop(true)
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
