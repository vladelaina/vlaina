export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  maxDimension: number = 256
): Promise<Blob | null> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return null;
  }

  let scale = 1;
  if (maxDimension > 0 && maxDimension < Infinity) {
    scale = Math.min(1, maxDimension / Math.max(pixelCrop.width, pixelCrop.height));
  }

  canvas.width = pixelCrop.width * scale;
  canvas.height = pixelCrop.height * scale;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/png');
  });
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    const cleanup = () => {
      image.removeEventListener('load', handleLoad);
      image.removeEventListener('error', handleError);
    };
    const handleLoad = () => {
      cleanup();
      resolve(image);
    };
    const handleError = (error: Event) => {
      cleanup();
      reject(error);
    };

    image.addEventListener('load', handleLoad);
    image.addEventListener('error', handleError);
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });
}
