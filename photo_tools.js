// Karkar & Lynn: photo helpers for the web app (lib/memories/camera_zoom_js.dart calls
// window.lynnKarkarPhoto). Safari has no real camera zoom, so the in-app camera enlarges its
// preview and this crops the shot to match, like a phone's digital zoom.
(function () {
  // The middle 1/zoom of the photo, scaled back to the original size, as JPEG bytes.
  async function cropCenter(bytes, zoom, quality) {
    const image = await createImageBitmap(new Blob([bytes]));
    try {
      const sw = Math.max(1, Math.round(image.width / zoom));
      const sh = Math.max(1, Math.round(image.height / zoom));
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, (image.width - sw) / 2, (image.height - sh) / 2, sw, sh, 0, 0, image.width, image.height);
      const blob = await new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('crop failed'))), 'image/jpeg', quality));
      return new Uint8Array(await blob.arrayBuffer());
    } finally {
      if (image.close) image.close();
    }
  }

  window.lynnKarkarPhoto = { cropCenter: cropCenter };
})();
