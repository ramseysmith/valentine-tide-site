# Valentine Tide — Landing Page

A standalone "coming soon" landing page for **Valentine Tide**, a goth and punk
surf apparel brand. Dark, moody, surf-meets-gothic. Captures emails for Drop 001
ahead of the full Shopify + Printful store.

> **Tagline:** Surf the Shadows

## Stack

Vanilla HTML, CSS, and JavaScript — no framework, no build step. Deployable to
GitHub Pages with zero config.

## File structure

```
valentine-tide-site/
  index.html     # markup, fonts, meta tags
  styles.css     # all styling; brand colors as CSS custom properties
  script.js      # email validation + form handling (FORM_ENDPOINT at top)
  assets/        # logo PNGs, favicon, OG image (add your own)
  README.md
```

## Brand kit

| Token        | Value     | Use                                  |
| ------------ | --------- | ------------------------------------ |
| Bone white   | `#F5F0E8` | Primary text, wordmark on dark       |
| Blood red    | `#8B0000` | Accent, the word "TIDE", buttons     |
| Near black   | `#161616` | Background base                      |

- **Display font:** [Pirata One](https://fonts.google.com/specimen/Pirata+One) (Google Fonts) — wordmark + headers
- **Body font:** Inter (Google Fonts), falling back to Helvetica Neue

Colors live as CSS custom properties at the top of `styles.css` (`--bone`,
`--blood`, `--near-black`) so they are easy to tweak in one place.

## Run locally

It's a static site, so any static server works. Pick one:

```bash
# Python 3
python3 -m http.server 8000

# or Node
npx serve .
```

Then open <http://localhost:8000>. You can also just open `index.html` directly
in a browser, though a local server better matches the live environment.

## Assets

Drop your files into `assets/`:

- `wordmark.png` — transparent wordmark (page degrades to styled Pirata One text if missing)
- `favicon.png` — browser tab icon
- `og-image.png` — Open Graph preview image (referenced in `index.html`)

Update the `og:url` and favicon paths in `index.html` once finalized.

## Configure the email form

Open `script.js` and set `FORM_ENDPOINT` to your real endpoint (Formspree,
Shopify, etc.):

```js
const FORM_ENDPOINT = "https://formspree.io/f/yourid";
```

While it's left as the placeholder, the form simulates a successful submit so you
can preview the success state.

## Deploy to GitHub Pages

1. Create a GitHub repo and push these files to the `main` branch.
2. In the repo: **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to *Deploy from a branch*.
4. Choose branch `main`, folder `/ (root)`, and **Save**.
5. Your site goes live at `https://<username>.github.io/<repo>/` within a minute or two.

For a custom domain (`valentinetide.com`): add it under **Settings → Pages →
Custom domain**, then point your DNS at GitHub Pages. A `CNAME` file will be
created in the repo automatically.

---

© Graysmith Labs LLC
