/**
 * ============================================================
 *  PROJECTS.JS — The CMS Data File
 * ============================================================
 *  This file is your content database. Each key in the
 *  `projects` object corresponds to a unique project ID.
 *
 *  To add or edit a project, see CONTENT_GUIDE.md
 * ============================================================
 */

const projects = {

    // ── Project 1 ─────────────────────────────────────────────
    "generative-identity": {
        title: "Generative Identity System",
        year: "2024",
        role: "Design & Code",
        client: "Public Knowledge Studio",
        tags: ["Generative", "Branding", "Motion"],

        // thumbnail shown in the grid on index.html
        // (the grid still loads from the img/ folder directly — this is just metadata)
        thumbnail: "img/col1/1.mp4",
        thumbnailType: "video", // "video" | "image"

        /**
         * content[] — ordered list of blocks that appear on the project page.
         * Each block is one of three types:
         *
         *   { type: "image",       src: "...",  alt: "..." }
         *   { type: "video",       src: "...",  poster: "..." }   ← poster is optional
         *   { type: "text",        body: "..." }
         *
         * Stack them in any order you like. Images & videos are full-width.
         * Text blocks appear between them.
         */
        content: [
            {
                type: "video",
                src: "img/col1/1.mp4"
            },
            {
                type: "text",
                body: "A system that evolves over time — each output is unique, yet unmistakably part of the same identity. Built using a generative engine that interprets brand parameters as constraints rather than fixed rules."
            },
            {
                type: "image",
                src: "img/col1/2.jpg",
                alt: "Generative identity output spread"
            },
            {
                type: "text",
                body: "The engine produces hundreds of variations across print, digital, and motion — all from a single source of truth."
            },
            {
                type: "video",
                src: "img/col1/3.mp4"
            },
            {
                type: "video",
                src: "img/col1/4.mp4"
            },
            {
                type: "image",
                src: "img/col1/5.png",
                alt: "Final brand system overview"
            }
        ]
    },

    // ── Project 2 ─────────────────────────────────────────────
    "typography-motion": {
        title: "Typography Motion Study",
        year: "2023",
        role: "Motion Design",
        client: "Personal Project",
        tags: ["Typography", "Motion", "Kinetic"],

        thumbnail: "img/col2/1.png",
        thumbnailType: "image",

        content: [
            {
                type: "image",
                src: "img/col2/1.png",
                alt: "Typography motion still"
            },
            {
                type: "image",
                src: "img/col2/2.jpg",
                alt: "Type specimen"
            },
            {
                type: "text",
                body: "Exploring kinetic type through code — each letterform treated as a particle with physical properties. The result is a system where meaning and movement are inseparable."
            },
            {
                type: "video",
                src: "img/col2/3.mp4"
            },
            {
                type: "video",
                src: "img/col2/4.mp4"
            },
            {
                type: "image",
                src: "img/col2/5.png",
                alt: "Typography grid study"
            }
        ]
    },

    // ── Project 3 ─────────────────────────────────────────────
    "visual-systems": {
        title: "Visual Systems Research",
        year: "2023",
        role: "Research & Design",
        client: "Personal Project",
        tags: ["Systems", "Research", "Print"],

        thumbnail: "img/col3/1.png",
        thumbnailType: "image",

        content: [
            {
                type: "image",
                src: "img/col3/1.png",
                alt: "Visual systems research board"
            },
            {
                type: "image",
                src: "img/col3/2.png",
                alt: "System diagrams"
            },
            {
                type: "text",
                body: "An investigation into how flexible visual systems can extend across formats without losing coherence. The research maps the tension between constraint and freedom in identity design."
            },
            {
                type: "image",
                src: "img/col3/3.jpg",
                alt: "Print output"
            },
            {
                type: "video",
                src: "img/col3/4.mp4"
            },
            {
                type: "image",
                src: "img/col3/5.png",
                alt: "System overview"
            },
            {
                type: "video",
                src: "img/col3/6.mp4"
            }
        ]
    },

    // ── Project 4 ─────────────────────────────────────────────
    "motion-loops": {
        title: "Motion Loops",
        year: "2024",
        role: "Motion Design & Code",
        client: "Various",
        tags: ["Motion", "Loop", "Generative"],

        thumbnail: "img/col4/1.mp4",
        thumbnailType: "video",

        content: [
            {
                type: "video",
                src: "img/col4/1.mp4"
            },
            {
                type: "video",
                src: "img/col4/2.mp4"
            },
            {
                type: "text",
                body: "A series of generative motion loops — each driven by different mathematical systems. The work explores rhythm, repetition, and the aesthetics of code-driven animation."
            },
            {
                type: "video",
                src: "img/col4/3.mp4"
            },
            {
                type: "video",
                src: "img/col4/4.MP4"
            },
            {
                type: "video",
                src: "img/col4/5.mp4"
            }
        ]
    },

    // ── Project 5 ─────────────────────────────────────────────
    "brand-experiments": {
        title: "Brand Experiments",
        year: "2023",
        role: "Art Direction & Code",
        client: "Personal Project",
        tags: ["Branding", "Experimental", "Print"],

        thumbnail: "img/col5/1.jpg",
        thumbnailType: "image",

        content: [
            {
                type: "image",
                src: "img/col5/1.jpg",
                alt: "Brand experiment spread"
            },
            {
                type: "image",
                src: "img/col5/2.png",
                alt: "Brand mark exploration"
            },
            {
                type: "text",
                body: "Experimental branding work that treats the brand mark as a living object — something that responds, mutates, and adapts while remaining immediately recognisable."
            },
            {
                type: "video",
                src: "img/col5/4.mp4"
            },
            {
                type: "image",
                src: "img/col5/3.png",
                alt: "Application mockup"
            },
            {
                type: "video",
                src: "img/col5/5.MP4"
            }
        ]
    }

};
