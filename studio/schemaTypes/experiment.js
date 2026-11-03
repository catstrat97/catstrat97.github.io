import {defineType, defineField} from 'sanity'

// One experiment on the test.fun page. Every item in `media` becomes its own
// tile, shuffled into the grid; hovering any of them lights all of them — and,
// when `series` is set, every tile of every experiment in that series too.
export default defineType({
  name: 'experiment',
  title: 'Experiment',
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
      type: 'slug',
      options: {source: 'title', maxLength: 96},
    }),
    defineField({
      name: 'year',
      title: 'Year',
      type: 'number',
      validation: (Rule) => Rule.integer().min(2000).max(2100),
    }),
    defineField({
      name: 'series',
      title: 'Series',
      description:
        'Leave empty for a standalone experiment. Experiments sharing a series light up together on hover.',
      type: 'reference',
      to: [{type: 'series'}],
    }),
    defineField({
      name: 'media',
      title: 'Media',
      description: 'Each image or video becomes a tile in the grid.',
      type: 'array',
      of: [{type: 'mediaItem'}],
      validation: (Rule) => Rule.required().min(1),
    }),
  ],
  preview: {
    select: {title: 'title', series: 'series.title', media: 'media.0.image'},
    prepare({title, series, media}) {
      return {title, subtitle: series ? 'Series: ' + series : 'Standalone', media}
    },
  },
})
