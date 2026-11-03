import project from './project'
import siteSettings from './siteSettings'
import mediaItem from './mediaItem'
import textBlock from './textBlock'
import experiment from './experiment'
import series from './series'

// Two workspaces, two datasets (see sanity.config.js):
//   Work     — professional projects + site settings  (dataset: production)
//   test.fun — personal experiments + their series     (dataset: personal_projects)
// mediaItem is shared by both as an object type; the documents and the media
// library never mix.
export const workSchemaTypes = [project, siteSettings, mediaItem, textBlock]
export const testfunSchemaTypes = [experiment, series, mediaItem]
