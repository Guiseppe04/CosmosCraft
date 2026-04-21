/**
 * Social Media Icons Component
 * Displays SVG icons for social media platforms with scale hover effects
 * Icons maintain their original brand colors
 */

export function FacebookIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="#1877F2"
      className="transition-transform duration-300"
    >
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

export function InstagramIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#E4405F"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="transition-transform duration-300"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.4" cy="6.6" r="1" fill="#E4405F" stroke="none" />
    </svg>
  )
}

export function TikTokIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="#111111"
      className="transition-transform duration-300"
    >
      <path d="M14.7 3.5h2.8c.1 1.3.8 2.4 2 3v2.2c-1-.1-2-.5-2.8-1.1v6.3c0 3-2.3 5.1-5.2 5.1-2.7 0-4.9-2.1-4.9-4.8 0-2.9 2.3-5 5.2-5 .3 0 .6 0 .9.1v2.5c-.3-.1-.5-.1-.8-.1-1.4 0-2.5 1.1-2.5 2.5 0 1.3 1 2.4 2.3 2.4 1.6 0 2.4-1.2 2.4-2.8V3.5z" />
    </svg>
  )
}

export function YouTubeIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="#FF0000"
      className="transition-transform duration-300"
    >
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )
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
