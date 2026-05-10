import { getCssVar } from "../utils/cssUtils.js";

const backgroundColor = getCssVar('--ifm-background-color');

export const metaTags = [

  // Theme color meta tags
  {
    tagName: 'meta',
    attributes: {
      name: 'msapplication-TileColor',
      content: backgroundColor,
    },
  },
  {
    tagName: 'meta',
    attributes: {
      name: 'theme-color',
      content: backgroundColor,
    },
  },

  // Android Chrome icons
  {
    tagName: 'link',
    attributes: {
      rel: 'icon',
      type: 'image/png',
      sizes: '36x36',
      href: '/favicon/android-chrome-36x36.png',
    },
  },
  {
    tagName: 'link',
    attributes: {
      rel: 'icon',
      type: 'image/png',
      sizes: '48x48',
      href: '/favicon/android-chrome-48x48.png',
    },
  },
  {
    tagName: 'link',
    attributes: {
      rel: 'icon',
      type: 'image/png',
      sizes: '72x72',
      href: '/favicon/android-chrome-72x72.png',
    },
  },
  {
    tagName: 'link',
    attributes: {
      rel: 'icon',
      type: 'image/png',
      sizes: '96x96',
      href: '/favicon/android-chrome-96x96.png',
    },
  },
  {
    tagName: 'link',
    attributes: {
      rel: 'icon',
      type: 'image/png',
      sizes: '144x144',
      href: '/favicon/android-chrome-144x144.png',
    },
  },
  {
    tagName: 'link',
    attributes: {
      rel: 'icon',
      type: 'image/png',
      sizes: '192x192',
      href: '/favicon/android-chrome-192x192.png',
    },
  },
  {
    tagName: 'link',
    attributes: {
      rel: 'icon',
      type: 'image/png',
      sizes: '256x256',
      href: '/favicon/android-chrome-256x256.png',
    },
  },
  {
    tagName: 'link',
    attributes: {
      rel: 'icon',
      type: 'image/png',
      sizes: '384x384',
      href: '/favicon/android-chrome-384x384.png',
    },
  },
  {
    tagName: 'link',
    attributes: {
      rel: 'icon',
      type: 'image/png',
      sizes: '512x512',
      href: '/favicon/android-chrome-512x512.png',
    },
  },

  // Apple touch icons
  {
    tagName: 'link',
    attributes: {
      rel: 'apple-touch-icon',
      sizes: '57x57',
      href: '/favicon/apple-touch-icon-57x57.png',
    },
  },
  {
    tagName: 'link',
    attributes: {
      rel: 'apple-touch-icon',
      sizes: '60x60',
      href: '/favicon/apple-touch-icon-60x60.png',
    },
  },
  {
    tagName: 'link',
    attributes: {
      rel: 'apple-touch-icon',
      sizes: '72x72',
      href: '/favicon/apple-touch-icon-72x72.png',
    },
  },
  {
    tagName: 'link',
    attributes: {
      rel: 'apple-touch-icon',
      sizes: '76x76',
      href: '/favicon/apple-touch-icon-76x76.png',
    },
  },
  {
    tagName: 'link',
    attributes: {
      rel: 'apple-touch-icon',
      sizes: '114x114',
      href: '/favicon/apple-touch-icon-114x114.png',
    },
  },
  {
    tagName: 'link',
    attributes: {
      rel: 'apple-touch-icon',
      sizes: '120x120',
      href: '/favicon/apple-touch-icon-120x120.png',
    },
  },
  {
    tagName: 'link',
    attributes: {
      rel: 'apple-touch-icon',
      sizes: '144x144',
      href: '/favicon/apple-touch-icon-144x144.png',
    },
  },
  {
    tagName: 'link',
    attributes: {
      rel: 'apple-touch-icon',
      sizes: '152x152',
      href: '/favicon/apple-touch-icon-152x152.png',
    },
  },
  {
    tagName: 'link',
    attributes: {
      rel: 'apple-touch-icon',
      sizes: '167x167',
      href: '/favicon/apple-touch-icon-167x167.png',
    },
  },
  {
    tagName: 'link',
    attributes: {
      rel: 'apple-touch-icon',
      sizes: '180x180',
      href: '/favicon/apple-touch-icon-180x180.png',
    },
  },
  {
    tagName: 'link',
    attributes: {
      rel: 'apple-touch-icon',
      sizes: '1024x1024',
      href: '/favicon/apple-touch-icon-1024x1024.png',
    },
  },
  {
    tagName: 'link',
    attributes: {
      rel: 'apple-touch-icon-precomposed',
      href: '/favicon/apple-touch-icon-precomposed.png',
    },
  },

  // Standard favicons
  {
    tagName: 'link',
    attributes: {
      rel: 'icon',
      type: 'image/png',
      sizes: '16x16',
      href: '/favicon/favicon-16x16.png',
    },
  },
  {
    tagName: 'link',
    attributes: {
      rel: 'icon',
      type: 'image/png',
      sizes: '32x32',
      href: '/favicon/favicon-32x32.png',
    },
  },
  {
    tagName: 'link',
    attributes: {
      rel: 'icon',
      type: 'image/png',
      sizes: '48x48',
      href: '/favicon/favicon-48x48.png',
    },
  },

  // Web manifest
  {
    tagName: 'link',
    attributes: {
      rel: 'manifest',
      href: '/favicon/manifest.webmanifest',
    },
  }
];
