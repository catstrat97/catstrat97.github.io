import {defineType, defineField} from 'sanity'

// Editable copy for the home page header, intro, and footer.
export default defineType({
  name: 'siteSettings',
  title: 'Site Settings',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Name (top-left)',
      type: 'string',
      initialValue: 'sharang sharma',
    }),
    defineField({
      name: 'location',
      title: 'Location (top-right)',
      type: 'string',
      initialValue: 'New Delhi, IN',
    }),
    defineField({
      name: 'introParagraph',
      title: 'Intro paragraph',
      description: 'The large opening statement.',
      type: 'text',
      rows: 4,
    }),
    defineField({
      name: 'currentPrefix',
      title: 'Current — text before link',
      description: 'e.g. "Currently, I work at"',
      type: 'string',
    }),
    defineField({
      name: 'currentLinkLabel',
      title: 'Current — link label',
      description: 'e.g. "Public Knowledge Studio"',
      type: 'string',
    }),
    defineField({
      name: 'currentLinkUrl',
      title: 'Current — link URL',
      type: 'url',
    }),
    defineField({
      name: 'currentSuffix',
      title: 'Current — text after link',
      description: 'e.g. ", where I work with brand identities & flexible visual systems,"',
      type: 'string',
    }),
    defineField({
      name: 'navLinks',
      title: 'Nav links (top-right)',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            {name: 'label', title: 'Label', type: 'string'},
            {name: 'href', title: 'URL', type: 'string'},
          ],
          preview: {select: {title: 'label', subtitle: 'href'}},
        },
      ],
    }),
    defineField({
      name: 'socialLinks',
      title: 'Social links (footer)',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            {name: 'label', title: 'Label', type: 'string'},
            {name: 'href', title: 'URL', type: 'string'},
          ],
          preview: {select: {title: 'label', subtitle: 'href'}},
        },
      ],
    }),
  ],
  preview: {
    prepare() {
      return {title: 'Site Settings'}
    },
  },
})
