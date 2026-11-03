import {defineType, defineField} from 'sanity'

// A series groups experiments that belong to one system. On the test.fun grid,
// hovering any tile lights every tile of every experiment in its series.
export default defineType({
  name: 'series',
  title: 'Series',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      description: 'What ties these experiments together. Optional.',
      type: 'text',
      rows: 3,
    }),
  ],
})
