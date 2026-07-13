import AssetBrowser from '../components/cloudinary/AssetBrowser';

export default function CloudinaryAssetsPage() {
  return (
    <div className="min-h-screen bg-[#121212] p-6 text-gray-100">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-semibold text-[#D4AF55] mb-1">Cloudinary Assets</h1>
        <p className="text-sm text-gray-400 mb-6">
          Browse your Cloudinary folders. Click a folder to open it, click an image to render it.
        </p>
        <AssetBrowser />
      </div>
    </div>
  );
}
