import { useCallback, useEffect, useMemo, useState } from 'react';
import { cloudinaryAssetsApi } from '../../services/cloudinaryAssetsApi';
import { optimizeCloudinaryImage } from '../../utils/cloudinary';

/**
 * AssetBrowser
 * - Browses the Cloudinary folder tree (starting at the root folder).
 * - Clicking a FOLDER drills into it; clicking an IMAGE renders it on screen.
 */
export default function AssetBrowser() {
  const [folder, setFolder] = useState('');
  const [folders, setFolders] = useState([]);
  const [images, setImages] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const breadcrumbs = useMemo(() => {
    if (!folder) return [];
    return folder.split('/').map((segment, index, arr) => ({
      segment,
      path: arr.slice(0, index + 1).join('/'),
    }));
  }, [folder]);

  const load = useCallback(async (targetFolder) => {
    setLoading(true);
    setError(null);
    setSelected(null);
    try {
      const res = await cloudinaryAssetsApi.browse({ folder: targetFolder, max: 100 });
      const data = res?.data || {};
      setFolders(data.folders || []);
      setImages(data.images || []);
    } catch (err) {
      setError(err.message || 'Failed to load assets');
      setFolders([]);
      setImages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(folder);
  }, [folder, load]);

  const openFolder = (path) => setFolder(path);
  const goUp = () => {
    const parts = folder.split('/').filter(Boolean);
    parts.pop();
    setFolder(parts.join('/'));
  };
  const goRoot = () => setFolder('');

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Folder tree + thumbnails */}
      <div className="md:col-span-2 rounded-lg border border-gray-700 bg-[#1e1e1e] p-4">
        <div className="flex items-center justify-between mb-3">
          <nav className="text-sm text-gray-400 flex flex-wrap items-center gap-1">
            <button onClick={goRoot} className="text-[#D4AF55] hover:underline">root</button>
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.path} className="flex items-center gap-1">
                <span className="text-gray-600">/</span>
                <button
                  onClick={() => openFolder(crumb.path)}
                  className={i === breadcrumbs.length - 1 ? 'text-gray-200' : 'text-[#D4AF55] hover:underline'}
                >
                  {crumb.segment}
                </button>
              </span>
            ))}
          </nav>
          <div className="flex gap-2">
            <button onClick={goUp} disabled={!folder} className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-200 disabled:opacity-40">
              Up
            </button>
            <button onClick={() => load(folder)} className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-200">
              Refresh
            </button>
          </div>
        </div>

        {loading && <p className="text-gray-400 text-sm">Loading…</p>}
        {error && <p className="text-red-400 text-sm">{error}</p>}

        {!loading && !error && (
          <>
            {folders.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Folders</h4>
                <div className="flex flex-wrap gap-2">
                  {folders.map((f) => (
                    <button
                      key={f.path}
                      onClick={() => openFolder(f.path)}
                      className="flex items-center gap-2 rounded-md border border-gray-700 bg-[#2a2a2a] px-3 py-2 text-sm text-gray-200 hover:border-[#D4AF55]"
                    >
                      📁 {f.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Images</h4>
            {images.length === 0 ? (
              <p className="text-gray-500 text-sm">No images in this folder.</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                {images.map((img) => (
                  <button
                    key={img.public_id}
                    onClick={() => setSelected(img)}
                    title={img.public_id}
                    className="group relative aspect-square overflow-hidden rounded-md border border-gray-700 hover:border-[#D4AF55]"
                  >
                    <img
                      src={optimizeCloudinaryImage(img.secure_url, { width: 200 })}
                      alt={img.public_id}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Preview pane */}
      <div className="rounded-lg border border-gray-700 bg-[#1e1e1e] p-4">
        <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-3">Preview</h4>
        {selected ? (
          <div>
            <img
              src={optimizeCloudinaryImage(selected.secure_url, { width: 600 })}
              alt={selected.public_id}
              className="w-full rounded-md border border-gray-700"
            />
            <p className="mt-3 break-all text-xs text-gray-400">{selected.public_id}</p>
            <a
              href={selected.secure_url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-xs text-[#D4AF55] hover:underline"
            >
              Open original ↗
            </a>
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Click an image to render it here.</p>
        )}
      </div>
    </div>
  );
}
