'use strict';

var _sourceMapSupport2 = require('source-map-support');

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

(0, _sourceMapSupport2.install)();
var debug = require('debug')('metalsmith:markdown-taxonomy');
var async = require('async');
var path = require('path');
var minimatch = require('minimatch');
var marked = require('marked');

/**
 * Expose `plugin`.
 */

module.exports = plugin;

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
  var _ref = options || {},
      _ref$pattern = _ref.pattern,
      pattern = _ref$pattern === undefined ? '**/*.md' : _ref$pattern;

  return function markdown_taxonomy(files, metalsmith, done) {
    var tree = {};

    var process = function process(file, key, cb) {
      function transclusionLink(text) {
        var transclusion = /:\[.*\]\((\S*)\s?(\S?)\)/;
        var match = text.match(transclusion);
        if (!match) console.error('Warning could not recognise a transclusion link in the markdown taxonomy.', { text, key });
        return match ? match[1] : text;
      }

      // debug('key', key)
      if (minimatch(key, pattern)) {
        var tokens = marked.lexer(file.contents.toString(), options);

        var _path$parse = path.parse(key),
            current_name = _path$parse.name;

        tree[key] = tokens.reduce(function (_ref2, _ref3) {
          var taxonomy = _ref2.taxonomy,
              current = _ref2.current,
              heading = _ref2.heading,
              item = _ref2.item,
              dictionary = _ref2.dictionary;
          var type = _ref3.type,
              depth = _ref3.depth,
              text = _ref3.text;

          var _ref4 = type === 'heading' && depth === 1 ? [Object.assign({}, taxonomy, { [current_name]: {} }), current_name, '', false, dictionary] : type === 'heading' && depth === 2 ? [Object.assign({}, taxonomy, { [current]: Object.assign({}, taxonomy[current], { [text]: [] }) }), current, text, false, dictionary] : type === 'list_item_start' ? [taxonomy, current, heading, true, dictionary] : type === 'text' && item ? [Object.assign({}, taxonomy, {
            [current]: Object.assign({}, taxonomy[current], {
              [heading]: [].concat(_toConsumableArray(taxonomy[current][heading]), [transclusionLink(text)])
            })
          }), current, heading, true, Object.assign({}, dictionary, {
            [transclusionLink(text)]: {
              [current]: [].concat(_toConsumableArray(dictionary[transclusionLink(text)] ? dictionary[transclusionLink(text)][current] : []), [heading])
            }
          })] : type === 'list_item_end' ? [taxonomy, current, heading, false, dictionary] : [taxonomy, current, heading, item, dictionary],
              _ref5 = _slicedToArray(_ref4, 5),
              t = _ref5[0],
              c = _ref5[1],
              h = _ref5[2],
              i = _ref5[3],
              d = _ref5[4];

          // (type === "list_item_end" ) && debug('dictionary', dictionary);

          return { taxonomy: t, current: c, heading: h, item: i, dictionary: d };
        }, { taxonomy: {}, current: '', heading: '', item: false, dictionary: {} });
        return cb(null, file);
      }
      cb(null, file);
    };

    async.mapValues(files, process, function (err) {
      if (err) throw err;

      debug('tree', JSON.stringify(tree, true, 2));

      var dictionary = Object.keys(tree).reduce(function (acc, val) {
        var merge = Object.keys(tree[val].dictionary).reduce(function (a, v) {
          return Object.assign({}, a, { [v]: Object.assign({}, a[v], tree[val].dictionary[v]) });
        }, Object.assign({}, acc));
        // console.log('merge', merge)
        return Object.assign({}, acc, merge);
      }, {});

      // Map file names of the form `link.md`
      var mapping = Object.keys(dictionary).reduce(function (acc, val) {
        return Object.assign({}, acc, { [val + '.md']: dictionary[val] });
      }, {});

      // Map file names of the form `link/index.md`
      var mapping_folder = Object.keys(dictionary).reduce(function (acc, val) {
        return Object.assign({}, acc, { [val + '/index.md']: dictionary[val] });
      }, {});

      // debug('mappings: ', Object.keys(mapping));

      Object.keys(files).forEach(function (key) {
        var match = Object.keys(mapping).includes(key) || Object.keys(mapping_folder).includes(key);
        if (match) {
          files[key] = Object.assign({}, files[key], mapping[key]);
        }
      });
      done();
    });
  };
}