import {defineType, defineField} from 'sanity'

// A paragraph of body copy inside a project's content flow.
export default defineType({
  name: 'textBlock',
  title: 'Text',
  type: 'object',
  fields: [
    defineField({
      name: 'body',
      title: 'Body',
      type: 'text',
      rows: 4,
      validation: (Rule) => Rule.required(),
    }),
  ],
  preview: {
    select: {body: 'body'},
    prepare({body}) {
      return {title: body ? body.slice(0, 60) : 'Text', subtitle: 'Text block'}
    },
  },
})
