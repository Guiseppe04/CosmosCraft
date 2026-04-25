/**
 * Utility for uploading files directly to Cloudinary from the browser.
 * Requires unsigned upload preset configured in Cloudinary.
 */

export const uploadToCloudinary = async (file, options = {}) => {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  const folder = options.folder || 'cosmoscraft/admin_uploads';

  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary environment variables are missing (VITE_CLOUDINARY_CLOUD_NAME, VITE_CLOUDINARY_UPLOAD_PRESET)');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  formData.append('folder', folder);

  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error?.message || 'Failed to upload image to Cloudinary');
    }

    const data = await res.json();
    return data.secure_url;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
};

export const optimizeCloudinaryImage = (url, options = {}) => {
  if (!url || typeof url !== 'string' || !url.includes('res.cloudinary.com') || !url.includes('/upload/')) {
    return url;
  }

  const transformations = ['f_auto', 'q_auto'];
  if (options.width) transformations.push(`w_${Math.max(1, Math.round(options.width))}`);
  if (options.height) transformations.push(`h_${Math.max(1, Math.round(options.height))}`);
  transformations.push(options.crop || 'c_limit');

  return url.replace('/upload/', `/upload/${transformations.join(',')}/`);
};
