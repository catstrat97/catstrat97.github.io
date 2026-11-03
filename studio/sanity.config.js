import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {workSchemaTypes, testfunSchemaTypes} from './schemaTypes'

const projectId = process.env.SANITY_STUDIO_PROJECT_ID || '2m7dbr1b'

/* One Studio, two walled-off CMSs — switch between them from the workspace
   menu at the top left. Each has its own dataset, so content AND the media
   library stay separate:
     Work     → dataset `production` — professional projects, site settings
     test.fun → dataset `personal_projects` — personal experiments, by series */
export default defineConfig([
  {
    name: 'work',
    title: 'Work',
    subtitle: 'Professional projects',
    basePath: '/work',
    projectId,
    dataset: process.env.SANITY_STUDIO_DATASET || 'production',
    plugins: [
      structureTool({
        structure: (S) =>
          S.list()
            .title('Work')
            .items([
              S.listItem()
                .title('Site Settings')
                .id('siteSettings')
                .child(S.document().schemaType('siteSettings').documentId('siteSettings')),
              S.divider(),
              S.documentTypeListItem('project').title('Projects'),
            ]),
      }),
      visionTool(),
    ],
    schema: {types: workSchemaTypes},
  },
  {
    name: 'testfun',
    title: 'test.fun',
    subtitle: 'Personal experiments',
    basePath: '/test-fun',
    projectId,
    dataset: 'personal_projects',
    plugins: [
      structureTool({
        structure: (S) =>
          S.list()
            .title('test.fun')
            .items([
              S.documentTypeListItem('experiment').title('Experiments'),
              S.documentTypeListItem('series').title('Series'),
            ]),
      }),
      visionTool(),
    ],
    schema: {types: testfunSchemaTypes},
  },
])
