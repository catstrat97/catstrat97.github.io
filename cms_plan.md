# Plan: Static "CMS" for Media Projects

Since you are hosting on GitHub Pages (static hosting), the most efficient way to create a "CMS" feel without a complex backend or build step is to use **URL Parameters with a data file**.

This allows you to have **one single HTML template** that dynamically changes its content based on which project you clicked.

## Core Components

### 1. `projects.js` (The "Database")
We will create a structured Javascript file that contains all the details for your projects. This works like a CMS database.

```javascript
const projects = {
  "generative-identity": {
    title: "Generative Identity System",
    description: "A system that evolves over time...",
    media: "img/col1/1.mp4",
    type: "video", // or 'image'
    credits: "Client: XYZ",
    year: "2024"
  },
  "typography-study": {
    title: "Typography Motion Study",
    description: "Exploring kinetic type...",
    media: "img/col2/2.jpg",
    type: "image",
    credits: "Personal Project",
    year: "2023"
  }
  // Add more projects here...
};
```

### 2. `project.html` (The Template)
This is the **single common setup** you asked for. It will look like this:

- **Header/Nav**: Consistent with `index.html`.
- **Content Area**: Empty HTML elements with IDs (e.g., `<h1 id="project-title"></h1>`).
- **Script**: A small block of JS that runs on load:
    1. Reads `?id=generative-identity` from the URL.
    2. Finds the corresponding data in `projects.js`.
    3. Fills in the blank HTML elements with that data.

### 3. Update `index.html` (The Catalog)
We will wrap your existing grid items in links.

**Current:**
```html
<video autoplay muted loop>
  <source src="img/col1/1.mp4" type="video/mp4">
</video>
```

**New:**
```html
<a href="project.html?id=generative-identity">
  <video autoplay muted loop>
    <source src="img/col1/1.mp4" type="video/mp4">
  </video>
</a>
```

## Work Required

1.  **Create `projects.js`**: I'll set up the file structure for you to fill in.
2.  **Create `project.html`**: I'll build the template with your styling.
3.  **Link Items**: We'll update a few items in `index.html` to test the system.

**Shall I proceed with creating the `projects.js` and `project.html` files?**
