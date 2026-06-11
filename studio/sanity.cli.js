import {defineCliConfig} from 'sanity/cli'

// projectId is also read from the SANITY_STUDIO_PROJECT_ID env var if set.
const projectId = process.env.SANITY_STUDIO_PROJECT_ID || '2m7dbr1b'
const dataset = process.env.SANITY_STUDIO_DATASET || 'production'

export default defineCliConfig({
  api: {projectId, dataset},
})
