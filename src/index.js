const debug = require('debug')('metalsmith:markdown-taxonomy')
const async = require('async')
const path = require('path')
const minimatch = require('minimatch')
const marked = require('marked')

/**
 * Expose `plugin`.
 */

module.exports = plugin

/**
 *
 * Metalsmith plugin to transform navigation markdown files into a taxonomy structure.
 *
 * @param {Object} options
 * @param {string} options.pattern Pattern for navigation files.
 *
 * @return {Function}
 */

function plugin(options) {
  const { pattern = '**/*.md' } = options || {}

  return function markdown_taxonomy(files, metalsmith, done) {
    const tree = {}

    const process = (file, key, cb) => {
      function categoryLink(text) {
        const link = /\[.*\]\((\S*)\s?(\S?)\)/
        const match = text.match(link)
        if (!match)
          console.error(
            'Warning could not recognise a link in the markdown taxonomy.',
            { text, key }
          )
        return match ? match[1] : text
      }

      // debug('key', key)
      if (minimatch(key, pattern)) {
        const tokens = marked.lexer(file.contents.toString(), options)
        const { name: current_name } = path.parse(key)
        tree[key] = tokens.reduce(
          (
            { taxonomy, current, heading, item, dictionary },
            { type, depth, text }
          ) => {
            const [t, c, h, i, d] =
              type === 'heading' && depth === 1
                ? [
                    { ...taxonomy, [current_name]: {} },
                    current_name,
                    '',
                    false,
                    dictionary,
                  ]
                : type === 'heading' && depth === 2
                ? [
                    {
                      ...taxonomy,
                      [current]: {
                        ...taxonomy[current],
                        [categoryLink(text)]: [],
                      },
                    },
                    current,
                    categoryLink(text),
                    false,
                    dictionary,
                  ]
                : type === 'list_item_start'
                ? [taxonomy, current, heading, true, dictionary]
                : type === 'text' && item
                ? [
                    {
                      ...taxonomy,
                      [current]: {
                        ...taxonomy[current],
                        [heading]: [
                          ...taxonomy[current][heading],
                          categoryLink(text),
                        ],
                      },
                    },
                    current,
                    heading,
                    true,
                    {
                      ...dictionary,
                      [categoryLink(text)]: {
                        [current]: [
                          ...(dictionary[categoryLink(text)]
                            ? dictionary[categoryLink(text)][current]
                            : []),
                          heading,
                        ],
                      },
                    },
                  ]
                : type === 'list_item_end'
                ? [taxonomy, current, heading, false, dictionary]
                : [taxonomy, current, heading, item, dictionary]

            // (type === "list_item_end" ) && debug('dictionary', dictionary);

            return {
              taxonomy: t,
              current: c,
              heading: h,
              item: i,
              dictionary: d,
            }
          },
          {
            taxonomy: {},
            current: '',
            heading: '',
            item: false,
            dictionary: {},
          }
        )
        return cb(null, file)
      }
      cb(null, file)
    }

    async.mapValues(files, process, err => {
      if (err) throw err

      debug('tree', JSON.stringify(tree, true, 2))

      // Add taxonomy to global metadata
      const metadata = metalsmith.metadata()
      metadata['taxonomy'] = Object.keys(tree).reduce(
        (acc, leaf) => ({ ...acc, ...tree[leaf].taxonomy }),
        {}
      )

      debug('taxonomy', metadata['taxonomy'])
      const dictionary = Object.keys(tree).reduce(function(acc, val) {
        const merge = Object.keys(tree[val].dictionary).reduce(
          function(a, v) {
            return { ...a, [v]: { ...a[v], ...tree[val].dictionary[v] } }
          },
          { ...acc }
        )
        // console.log('merge', merge)
        return { ...acc, ...merge }
      }, {})

      debug('dictionary', JSON.stringify(dictionary, true, 2))

      // Map file names of the form `link.md`
      const mapping = Object.keys(dictionary).reduce(
        (acc, val) => ({ ...acc, [val + '.md']: dictionary[val] }),
        {}
      )

      // Map file names of the form `link/index.md`
      const mapping_folder = Object.keys(dictionary).reduce(
        (acc, val) => ({ ...acc, [val + '/index.md']: dictionary[val] }),
        {}
      )

      debug('mappings: ', JSON.stringify(mapping))

      Object.keys(files).forEach(key => {
        const match =
          Object.keys(mapping).includes(key) ||
          Object.keys(mapping_folder).includes(key)
        if (match) {
          files[key] = { ...files[key], ...mapping[key] }
        }
      })
      done()
    })
  }
}
