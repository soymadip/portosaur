# Progressive Web App (PWA)

Portosaur turns your portfolio into a fully compliant Progressive Web App (PWA) out of the box. This means users on Android, Windows, and ChromeOS can install your site directly to their device like a native application!

## App Shortcuts

When a user installs your Portosaur site and long-presses (or right-clicks) the app icon on their device, they will see handy App Shortcuts.

By default, Portosaur automatically creates shortcuts for your:

- **Notes** (`/notes`)
- **Blog** (`/blog`)
- **Tasks** (`/tasks`) _(if enabled)_

The shortcut icons are automatically extracted from the theme assets and dynamically colored to perfectly match your chosen primary color scheme from `config.yml`.

## Screenshots

When a user clicks "Install App" in Chrome, Android will look for screenshots to display a beautiful "Rich Installation" prompt (similar to a carousel in the Google Play Store).

Portosaur fully automates this process for you with **zero configuration**:

1. **Take Screenshots**: Take screenshots of your portfolio on a Desktop (widescreen) and on a Mobile phone (tall screen). Save them as `.png`, `.jpg`, or `.webp` files.
   _Tip: For the best results, prefix your main homepage screenshots with `home-` (e.g., `home-mobile.png`, `home-desktop.png`). Portosaur will ensure these are shown first in the carousel! Other screenshots can be named `notes-mobile.png`, `blog-desktop.png`, etc._

2. **Drop them in Assets**: Place those image files directly into your `.playground/assets/screenshots/` directory (or wherever your `assets` directory is configured).
3. **Build**: That's it! When you run `portosaur dev` or `portosaur build`, Portosaur automatically scans that folder. It reads the image dimensions, calculates whether it's a mobile or desktop view, and automatically builds a fully W3C-compliant PWA manifest for you!

## Testing your PWA

The easiest way to test your PWA is using [PWABuilder](https://www.pwabuilder.com/).
Simply deploy your site to the web, enter your URL, and PWABuilder will analyze your PWA compliance. (With Portosaur's automated screenshots, you should hit a perfect score!)

_Note: PWABuilder may show yellow warnings for "Optional" features like `file_handlers`, `widgets`, or `share_target`. These are advanced operating system features that a portfolio site does not need, so you can safely ignore them!_
