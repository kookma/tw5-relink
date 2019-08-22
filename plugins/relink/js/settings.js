/*\
module-type: library

This handles the fetching and distribution of relink settings.

\*/

var utils = require('$:/plugins/flibbles/relink/js/utils.js');

exports.getFields = function(options) {
	return getSettings(options).fields;
};

exports.getOperators = function(options) {
	return getSettings(options).operators;
};

exports.getAttributes = function(options) {
	return getSettings(options).attributes;
};

/**Factories define methods that create settings given config tiddlers.
 * for factory method 'example', it will be called once for each:
 * "$:/config/flibbles/relink/example/..." tiddler that exists.
 * the argument "key" will be set to the contents of "..."
 *
 * The reason I build relink settings in this convoluted way is to minimize
 * the number of times tiddlywiki has to run through EVERY tiddler looking
 * for relink config tiddlers.
 *
 * Also, by exporting "factories", anyone who extends relink can patch in
 * their own factory methods to create settings that are generated exactly
 * once per rename.
 */
exports.factories = {
	attributes: function(attributes, tiddler, key) {
		if (utils.selectRelinker(tiddler.fields.text)) {
			var elem = root(key);
			var attr = key.substr(elem.length+1);
			attributes[elem] = attributes[elem] || Object.create(null);
			attributes[elem][attr] = tiddler.fields.text;
		}
	},
	fields: function(fields, tiddler, name) {
		if (utils.selectRelinker(tiddler.fields.text)) {
			fields[name] = tiddler.fields.text;
		}
	},
	/* The configuration tiddlers require "yes" as text. This is so shadow
	 * tiddlers can be overridden with blank, or "no" to disable them.
	 */
	operators: function(operators, tiddler, name) {
		if (tiddler.fields.text === "yes") {
			operators[name] = true;
		}
	}
};

/**We're caching the generated settings inside of options. Not exactly how
 * options was meant to be used, but it's fiiiiine.
 * The wiki global cache isn't a great place, because it'll get cleared many
 * times during a bulk relinking operation, and we can't recalculate this every
 * time without exploding a rename operation's time.
 * options works great. It only lasts just as long as the rename.
 * No longer, no shorter.
 */
function getSettings(options) {
	var secretCache = "__relink_settings";
	var cache = options[secretCache];
	if (cache === undefined) {
		cache = options[secretCache] = compileSettings(options.wiki);
	}
	return cache;
};

function compileSettings(wiki) {
	var prefix = "$:/config/flibbles/relink/";
	var settings = Object.create(null);
	wiki.eachShadowPlusTiddlers(function(tiddler, title) {
		if (title.startsWith(prefix)) {
			var remainder = title.substr(prefix.length);
			var category = root(remainder);
			var factory = exports.factories[category];
			if (factory) {
				settings[category] = settings[category] || Object.create(null);
				var name = remainder.substr(category.length+1);
				factory(settings[category], tiddler, name);
			}
		}
	});
	return settings;
};

function root(string) {
	var index = string.indexOf('/');
	if (index >= 0) {
		return string.substr(0, index);
	}
};
