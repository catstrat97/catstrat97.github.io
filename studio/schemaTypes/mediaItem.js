import {defineType, defineField} from 'sanity'

// A single piece of media — either an image or an uploaded video file.
// Used for project thumbnails and inside the project content array.
export default defineType({
  name: 'mediaItem',
  title: 'Media',
  type: 'object',
  fields: [
    defineField({
      name: 'mediaType',
      title: 'Type',
      type: 'string',
      options: {
        list: [
          {title: 'Image', value: 'image'},
          {title: 'Video', value: 'video'},
        ],
        layout: 'radio',
      },
      initialValue: 'image',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'image',
      title: 'Image',
      type: 'image',
      options: {hotspot: true},
      hidden: ({parent}) => parent?.mediaType !== 'image',
    }),
    defineField({
      name: 'video',
      title: 'Video file',
      description: 'Upload a compressed .webm or .mp4. Keep files small for fast loading.',
      type: 'file',
      options: {accept: 'video/*'},
      hidden: ({parent}) => parent?.mediaType !== 'video',
    }),
    defineField({
      name: 'alt',
      title: 'Alt text',
      description: 'Describes the media for accessibility / SEO.',
      type: 'string',
    }),
  ],
  preview: {
    select: {mediaType: 'mediaType', image: 'image', alt: 'alt'},
    prepare({mediaType, image, alt}) {
      return {
        title: alt || (mediaType === 'video' ? 'Video' : 'Image'),
        subtitle: mediaType,
        media: image,
      }
    },
  },
})
