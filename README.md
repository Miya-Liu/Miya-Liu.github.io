# Thought Recorder

Personal site and notes — research, algorithms, code, and short reflections. Static HTML published with [GitHub Pages](https://pages.github.com/).

**Live site:** [https://miya-liu.github.io](https://miya-liu.github.io)

## Repository layout

| Path | Purpose |
|------|---------|
| [`index.html`](index.html) | Home / landing |
| [`blog.html`](blog.html) | Post archive |
| [`posts/`](posts/) | Individual articles (one HTML file per topic) |
| [`pages/`](pages/) | Standalone pages (e.g. reading list) |
| [`templates/`](templates/) | Starter templates (not linked from the site) |
| [`assets/`](assets/) | CSS, JavaScript, fonts, images; `sass/` holds SCSS sources for `assets/css/main.css` |
| [`images/`](images/) | Images referenced from posts |
| [`_archive/`](_archive/) | Old backups |

For more detail, see [`STRUCTURE.txt`](STRUCTURE.txt).

## Local preview

Open `index.html` in a browser, or serve the repo root with any static file server (for example `npx serve .`).

### Local file-backed likes/comments (no Firebase)

For local development, you can persist post likes and comments to a JSON file in this repo:

1. Start the local interactions API:
   - `node _scripts/local-interactions-server.mjs`
2. In `assets/js/pageviews-config.js`, set:
   - `window.__LOCAL_INTERACTIONS__.enabled = true`
   - Keep `apiBase` as `http://127.0.0.1:8787` (or update both if you change the port)
3. Run the site with a local static server and open it in the browser.

Data is stored in `_local_data/interactions.json`.

## Content and copyright

**Writing (posts and original text on this site):** for reading on **[miya-liu.github.io](https://miya-liu.github.io)** only. All rights reserved. Please do not republish, scrape for reuse, or mirror without permission. Short quotations with attribution may be fine under fair dealing / fair use; ask if unsure.

The same line appears in the site footer on pages so visitors see a consistent notice.

## Credits (third-party)

The blog layout builds on **Future Imperfect** by [HTML5 UP](https://html5up.net) (free for personal and commercial use under [CCA 3.0](https://html5up.net/license); see also [`LICENSE.txt`](LICENSE.txt)). Demo assets and third-party credits from the original template are noted in the upstream license files.

**Your original writing and customizations** are not covered by the HTML5 UP license; they are © Miya Liu.
