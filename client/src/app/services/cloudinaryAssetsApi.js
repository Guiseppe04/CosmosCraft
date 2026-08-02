const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api';

export const cloudinaryAssetsApi = {
  browse: async ({ folder = '', max = 60, cursor = null } = {}) => {
    const params = new URLSearchParams();
    if (folder) params.set('folder', folder);
    if (max) params.set('max', String(max));
    if (cursor) params.set('cursor', cursor);

    const res = await fetch(`${API_BASE_URL}/cloudinary/browse?${params.toString()}`, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.message || 'Failed to browse Cloudinary assets');
    }
    return res.json();
  },
};
