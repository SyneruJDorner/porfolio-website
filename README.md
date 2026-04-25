# Portfolio Website

Personal portfolio for Justin Dylan Dörner.

## Structure

```
├── index.html          # Main portfolio page
├── resume.html         # Resume / CV page
├── favicon.ico         # Browser tab icon
├── robots.txt          # Crawler directives
├── sitemap.xml         # Search engine sitemap
├── site.webmanifest    # PWA manifest
├── css/
│   ├── styles.css      # Portfolio styles
│   └── resume.css      # Resume styles
├── js/
│   └── script.js       # Scroll, animation, background
└── assets/
    └── bg/
        └── background.mp4  # Scroll-scrubbed background video
```

## Run locally

```bash
npm start              # Dev server (no caching)
npm run start:perf     # Perf server (proper cache headers — use for Lighthouse)
```

Open `http://localhost:8080/`

## Scroll background video

1. Add your video at `assets/bg/background.mp4`.
2. Reload the page.

Behavior:

- If `assets/bg/background.mp4` loads successfully, scroll position scrubs through the video timeline.
- No frame fallback is used.

Recommendation:

- For smoother scrubbing, encode with short GOP/all-intra and broad browser compatibility (H.264 is usually safest).
- AV1 can work but may be heavier to decode on some devices and less predictable for seek-heavy scroll scrubbing.

## Favicon

Logo created with [RealFaviconGenerator Logo Maker](https://realfavicongenerator.net/logo-maker).
Converted to `.ico` using [Favicon.io Converter](https://favicon.io/favicon-converter/).

## Missing assets (referenced but not yet created)

| File                   | Used in                | Notes                                              |
| ---------------------- | ---------------------- | -------------------------------------------------- |
| `apple-touch-icon.png` | Both HTML files        | 180×180px PNG — iOS home screen icon               |
| `assets/og-image.jpg`  | OG + Twitter meta tags | 1200×630px — link preview image for social sharing |
