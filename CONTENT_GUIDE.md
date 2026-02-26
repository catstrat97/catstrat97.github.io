# Content Guide — How to Add & Edit Projects

This site uses a **static CMS** powered by a single JavaScript file (`projects.js`).  
There is no dashboard, no server, and no build step required.  
All changes are made by editing plain text files and pushing to GitHub.

---

## File Map

| File | What it does |
|---|---|
| `projects.js` | Your **content database** — edit this to add/modify projects |
| `project.html` | The universal project template — **do not edit** unless changing layout |
| `project.css` | Styles for the project page — **do not edit** unless changing look |
| `index.html` | The home grid — edit only to add or remove a grid column link |
| `img/` | Where all images and videos live |

---

## How the System Works

1. Each thumbnail on the index grid is wrapped in a link:  
   `<a href="project.html?id=my-project-id">…</a>`

2. When a user clicks, `project.html` loads and reads the `?id=` from the URL.

3. It looks up that ID in `projects.js` and dynamically renders the page.

4. The content on the project page is built from a `content[]` array — a list of **blocks** you define.

---

## The Three Block Types

Each item inside `content: [ … ]` is one of these:

### 1 — Image
```js
{ type: "image", src: "img/my-folder/photo.jpg", alt: "Description for screen readers" }
```

### 2 — Video
```js
{ type: "video", src: "img/my-folder/clip.mp4" }
// optional: add  poster: "img/my-folder/thumb.jpg"  for a preview frame
```

### 3 — Text
```js
{ type: "text", body: "Your description paragraph goes here." }
```

Stack them in **any order**. Images and videos are full-width columns. Text blocks sit between them.

---

## Adding a New Project

### Step 1 — Add your media files
Put all images and videos in a folder inside `img/`:
```
img/
  my-new-project/
    hero.mp4
    detail-1.jpg
    detail-2.jpg
    notes.png
```

### Step 2 — Add an entry in `projects.js`

Open `projects.js` and copy-paste this template **before the last `};`**:

```js
// ── My New Project ────────────────────────────────────────
"my-new-project": {
  title: "My New Project",
  year: "2025",
  role: "Design & Code",
  client: "Client Name",
  tags: ["Tag1", "Tag2", "Tag3"],

  // These are used only for future reference — the grid still
  // shows whatever media you put in index.html
  thumbnail: "img/my-new-project/hero.mp4",
  thumbnailType: "video", // "video" or "image"

  content: [
    // ── Add blocks in the order you want them to appear ──
    {
      type: "video",
      src: "img/my-new-project/hero.mp4"
    },
    {
      type: "text",
      body: "First paragraph of description."
    },
    {
      type: "image",
      src: "img/my-new-project/detail-1.jpg",
      alt: "Detail shot 1"
    },
    {
      type: "text",
      body: "Second paragraph — more context about this image."
    },
    {
      type: "image",
      src: "img/my-new-project/detail-2.jpg",
      alt: "Detail shot 2"
    },
    {
      type: "image",
      src: "img/my-new-project/notes.png",
      alt: "Process notes"
    }
  ]
},
```

> **Important:** The key `"my-new-project"` must be a **unique ID** using only lowercase letters, numbers, and hyphens. No spaces.

### Step 3 — Link it from the grid in `index.html`

Find the relevant `<div class="vert">` column where you want the thumbnail to appear and add:

```html
<a href="project.html?id=my-new-project" class="grid-link">
  <video autoplay muted loop playsinline>
    <source src="img/my-new-project/hero.mp4" type="video/mp4">
  </video>
</a>
```

Or for an image thumbnail:
```html
<a href="project.html?id=my-new-project" class="grid-link">
  <img src="img/my-new-project/hero.jpg" alt="My New Project">
</a>
```

### Step 4 — Push to GitHub
```bash
git add .
git commit -m "Add: My New Project"
git push
```
GitHub Pages will update in ~30 seconds.

---

## Editing an Existing Project

Open `projects.js`, find the project by its key, and edit any fields directly:

- **Change the title/year/role/client** → edit those string values
- **Reorder content** → move the block objects up or down inside `content: [ ]`
- **Add a new image** → add a new `{ type: "image", … }` block at any position
- **Add a new text block** → add a `{ type: "text", body: "…" }` between any two blocks
- **Remove a block** → delete the entire `{ … }` object from the array (and the trailing comma)

---

## Renaming a Project ID

If you want to change the URL slug:

1. Change the key in `projects.js` (e.g. `"old-slug"` → `"new-slug"`)
2. Find every `href="project.html?id=old-slug"` in `index.html` and update to `new-slug`
3. Push to GitHub

---

## Project Tags

Tags appear as small outlined badges under the title. Add as many as you like:
```js
tags: ["Generative", "Branding", "Motion", "Type", "Code"]
```

---

## Image & Video Sizing

- **Images**: any aspect ratio, any resolution. Use `.jpg`, `.png`, or `.webp`.
- **Videos**: use `.mp4` (H.264) for broadest browser support.  
  Tip: keep individual files under 20 MB for fast load times on GitHub Pages.
- All media is displayed **full-width** in the content column.

---

## Current Project IDs

| ID | Title |
|---|---|
| `generative-identity` | Generative Identity System |
| `typography-motion` | Typography Motion Study |
| `visual-systems` | Visual Systems Research |
| `motion-loops` | Motion Loops |
| `brand-experiments` | Brand Experiments |

---

*Last updated: Feb 2026*
