import {defineType, defineField} from 'sanity'

export default defineType({
  name: 'project',
  title: 'Project',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      description: 'The URL id for this project (e.g. project.html?id=sycamore).',
      type: 'slug',
      options: {source: 'title', maxLength: 96},
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'year',
      title: 'Year',
      description: 'Full year, e.g. 2026. Shown abbreviated (26’) in the list.',
      type: 'number',
      validation: (Rule) => Rule.required().integer().min(2000).max(2100),
    }),
    defineField({
      name: 'role',
      title: 'Role',
      description: 'Shown in the Role column, e.g. "Identity, Motion".',
      type: 'string',
    }),
    defineField({
      name: 'client',
      title: 'Client',
      type: 'string',
    }),
    defineField({
      name: 'tags',
      title: 'Tags',
      description: 'Used for the filter chips. e.g. Identity, Motion, Poster.',
      type: 'array',
      of: [{type: 'string'}],
      options: {layout: 'tags'},
    }),
    defineField({
      name: 'displayOrder',
      title: 'Display order',
      description: 'Lower numbers appear first within their year. Optional.',
      type: 'number',
    }),
    defineField({
      name: 'thumbnail',
      title: 'Thumbnail',
      description: 'Shown in the Grid view.',
      type: 'mediaItem',
    }),
    defineField({
      name: 'content',
      title: 'Content',
      description: 'The project detail page, in order. Mix text and media freely.',
      type: 'array',
      of: [{type: 'textBlock'}, {type: 'mediaItem'}],
    }),
  ],
  orderings: [
    {
      title: 'Year, newest first',
      name: 'yearDesc',
      by: [
        {field: 'year', direction: 'desc'},
        {field: 'displayOrder', direction: 'asc'},
      ],
    },
  ],
  preview: {
    select: {title: 'title', year: 'year', media: 'thumbnail.image'},
    prepare({title, year, media}) {
      return {title, subtitle: year ? String(year) : '', media}
    },
  },
})
