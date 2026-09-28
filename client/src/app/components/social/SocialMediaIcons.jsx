/**
 * Social Media Icons Component
 * Displays the brand SVG files from public/social with hover scale.
 */

const SOCIAL_ICONS = {
  facebook: '/social/facebook.svg',
  instagram: '/social/instagram.svg',
  tiktok: '/social/tiktok-svgrepo-com.svg',
  youtube: '/social/youtube.svg',
}

function SocialSvg({ name, alt }) {
  return (
    <img
      src={SOCIAL_ICONS[name]}
      alt={alt}
      className="h-5 w-5 object-contain transition-transform duration-300"
      loading="lazy"
    />
  )
}

export function FacebookIcon() {
  return <SocialSvg name="facebook" alt="Facebook" />
}

export function InstagramIcon() {
  return <SocialSvg name="instagram" alt="Instagram" />
}

export function TikTokIcon() {
  return <SocialSvg name="tiktok" alt="TikTok" />
}

export function YouTubeIcon() {
  return <SocialSvg name="youtube" alt="YouTube" />
}

export function SocialMediaLink({ icon: Icon, label, url }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-10 w-10 items-center justify-center rounded-full transition-transform duration-200 hover:scale-110"
      aria-label={label}
    >
      <Icon />
    </a>
  )
}
