# Bren Talking Points

A self-contained web tool for the Bren School's marketing and communications team: tag talking
points by topic, audience, and event; filter down to what a given moment calls for; and assemble
the result into a ready-to-deliver script.

Built as a static site — no build step, no server, no dependencies.

It runs in three places from the same sources: opened as a local file, served as a static site
(Fly.io config included), or bundled into a single page with `node build-artifact.js` and
published as a Claude artifact.

## Running it

Open `index.html` in a browser, or serve the directory locally:

```bash
npx http-server -p 8080 .
# then visit http://127.0.0.1:8080
```

Because it is a plain static site, it can also be dropped onto any web host or GitHub Pages as-is.

## What's in it

The tool ships preloaded with **102 talking points** covering the dean's messaging, faculty
research, education programs, student experience, and partnerships.

- `index.html` — app shell
- `css/styles.css` — styling
- `js/taxonomy.js` — the fixed tag taxonomy (topics, audiences, events)
- `js/seed-data.js` — the preloaded talking points, generated from `data/talking-points.json`
- `js/app.js` — filtering, script builder, templates, import/export
- `data/talking-points.json` — the talking points in their portable, importable form
- `build-artifact.js` — bundles everything into `dist/bren-talking-points.html` for publishing
- `Dockerfile`, `fly.toml` — static-server deployment config

## How it works

### Tagging

Each talking point carries three kinds of tags:

- **Topic** — two levels: a parent category and an optional child. A point tagged only with a
  parent (for example, `Faculty Research/Teaching Areas` with no child) is a general statement
  about that whole area.
- **Audience** — who the point is aimed at.
- **Event** — the kind of occasion it suits.

A **blank audience or event is deliberate, not unfinished.** It means the point applies
everywhere, so it stays visible no matter which audience or event you filter by. The interface
labels these points "Applies everywhere."

### Filtering

The left sidebar narrows the list by any combination of topic, audience, and event, plus a
free-text search across the point text. Checking a parent topic matches every point in that
category, including its children. Selections within a category are OR'd together; the three
categories are AND'd.

### Building a script

1. Check **add to script** on any point you want.
2. In the right-hand **Script** panel, reorder points with the arrow buttons and write an
   opening and closing line.
3. Click **Copy script** to put the assembled text on your clipboard, opening and closing lines
   included.

### Templates

**Save as template** stores the current script — its point order plus the opening and closing
lines — under a name you choose, so a recurring event can be rebuilt in one click the next time
it comes around. Load or delete saved templates from the Templates dropdown.

## Adding talking points

**One at a time:** click **Add talking point** and pick tags from the taxonomy.

**In bulk:** click **Import batch** and paste a JSON array. Points whose text exactly matches
something already in the tool are skipped, so re-importing the same file is safe.

```json
[
  {
    "text": "The talking point text goes here.",
    "topics": [{ "parent": "Dean", "child": "Reputation" }],
    "audiences": [],
    "events": []
  }
]
```

Only `text` is required. This is also the format to ask an assistant for when turning a source
document or web page into tagged talking points — share the taxonomy in `js/taxonomy.js` along
with the source material.

To extend the taxonomy itself, edit `js/taxonomy.js`.

## Where your data lives

Edits, added points, scripts, and templates are saved in **your browser's local storage**, per
browser and per device. They are not synced anywhere, and clearing site data clears them.

- **Export JSON** shows the full current set of talking points, to copy or download. Use it as a
  backup, or to move your collection to another browser or share it with a collaborator (who
  imports it via **Import batch**).
- The preloaded 102 points live in the code, so a browser with no saved data always starts from
  that baseline. To rebuild from it after unwanted changes, clear this site's local storage and
  reload.

To change what a fresh browser starts with, edit `data/talking-points.json` and regenerate the
seed file:

```bash
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data/talking-points.json', 'utf8'));
const withIds = data.map((d, i) => ({ id: 'tp-' + String(i + 1).padStart(3, '0'), ...d }));
fs.writeFileSync('js/seed-data.js', 'const SEED_TALKING_POINTS = ' + JSON.stringify(withIds, null, 2) + ';\n');
"
```
