/*\

Tests the new relinking wiki methods.

\*/

var utils = require("test/utils");
var relink = utils.relink;

function testField(value, expected, options) {
	[value, expected, options] = utils.prepArgs(value, expected, options);
	var field = options.field || "test";
	var type = options.type;
	if (type === undefined) {
		type = "title";
	}
	options.wiki.addTiddler(utils.fieldConf(field, type));
	var results = relink({[field]: value}, options);
	var output = results.tiddler.fields[field];
	if (typeof output === "object") {
		output = Array.prototype.slice.call(output);
	}
	expect(output).toEqual(expected);
	return results;
};

function testTags(value, expectedArray, options) {
	return testField(value, expectedArray,
	                 Object.assign({field: "tags", type: "list"}, options));
};

function testList(value, expectedArray, options) {
	return testField(value, expectedArray,
	                 Object.assign({field: "list", type: "list"}, options));
};

describe('relink', function() {

it("doesn't touch ineligible tiddlers", function() {
	var results = testTags("nothing here",["nothing", "here"]);
	expect($tw.utils.hop(results.tiddler.fields, 'modified')).toBe(false);
	results = testList("nothing here", ["nothing", "here"]);
	expect($tw.utils.hop(results.tiddler.fields, 'modified')).toBe(false);
});

it("touches eligible tiddlers", function() {
	var results = testTags("[[from here]]", ["to there"]);
	expect($tw.utils.hop(results.tiddler.fields, 'modified')).toBe(true);
});

it("handles getting no options at all", function() {
	var wiki = new $tw.Wiki();
	wiki.addTiddlers([
		{title: "X"},
		{title: "A", text: "[[X]]"}
	]);
	utils.collect("log", function() {
		// Just ensuring that this doesn't throw.
		wiki.renameTiddler("X", "Y");
	});
	expect(wiki.getTiddler("A").fields.text).toEqual("[[Y]]");
});

it("handles errors with at least some grace", function() {
	function thrower(exception, expected) {
		var oldParseStringArray = $tw.utils.parseStringArray;
		var wiki = new $tw.Wiki();
		var e;
		wiki.addTiddlers([
			{title: "tiddlertest", test: "A"},
			utils.fieldConf("test", "list")
		]);
		try {
			$tw.utils.parseStringArray = function() {
				throw new Error(exception);
			};
			wiki.renameTiddler("anything","something",{wiki: wiki});
		} catch (thrown) {
			e = thrown;
		} finally {
			$tw.utils.parseStringArray = oldParseStringArray;
		}
		expect(e).toBeDefined();
		expect(e.message).toEqual(expected);
	};
	//thrower("Ping", "Ping\nError relinking 'tiddlertest'");
	thrower('Boom', "Boom\nWhen relinking 'tiddlertest'");
});

it('still relinks tags', function() {
	var r = testTags("[[from here]] another", ['to there', 'another']);
	expect(r.log).toEqual(["Renaming 'from here' to 'to there' in tags of tiddler 'test'"]);
});

it('still relinks lists', function() {
	var r = testList("[[from here]] another", ['to there', 'another']);
	expect(r.log).toEqual(["Renaming 'from here' to 'to there' in list field of tiddler 'test'"]);
});

it('lists work with strange titles', function() {
	function works(title, wrapped) {
		//var expected = wrapped ? "A [["+title+"]] B" : "A "+title+" B";
		var expected = ["A", title, "B"];
		testList("A [[from here]] B", expected, {to: title});
	};
	works("weird]]");
	works("weird ]]");
	works("weird ]]");
	works("weird[[");
	works("weird [[");
	works("X[[Z]]Y");
	works("X [[ Z ]]Y", true);

	var thisFuckingValue = "weird ]]\xA0value";
	works(thisFuckingValue);
	// Just got to test that the crazy value is actually something
	// Tiddlywiki supports.  Seriously, when do these come up?
	var list = ["A", thisFuckingValue, "A tiddler", "B"];
	var strList = $tw.utils.stringifyList(list);
	var output = $tw.utils.parseStringArray(strList);
	expect(output).toEqual(list);
});

it('lists recognize impossibly strange titles', function() {
	function fails(title) {
		var options = {to: title, ignored: true,
		               field: "example", type: "list"};
		var list = "A [[from here]] B";
		var results = testField(list, options);
		expect(results.fails.length).toEqual(1);
	};
	fails("X and]] Y");
	fails("]] X");
});

it("lists don't fail when toTitle not in list", function() {
	var options = {to: "X and]] Y", field: "list", type: "list"};
	var results = testField("A B C", ["A", "B", "C"], options);
	expect(results.fails.length).toEqual(0);
});

/** I have chosen not to respect dontRenameInTags and dontRenameInLists
 *  because they are literally never used anywhere. Now you can just use
 *  the configuration.
 */
/*
it('still respects dontRenameInTags', function() {
	var t = relink({"tags": "[[from here]] another"}, {dontRenameInTags: true});
	expect(t.fields.tags.slice()).toEqual(['from here', 'another']);
});

it('still respects dontRenameInLists', function() {
	var t = relink({"list": "[[from here]] another"}, {dontRenameInLists: true});
	expect(t.fields.list.slice()).toEqual(['from here', 'another']);
});
*/

it('relinks custom field', function() {
	var r = testField("from here");
	expect(r.log).toEqual(["Renaming 'from here' to 'to there' in test field of tiddler 'test'"]);
});

it('relinks custom list', function() {
	var r = testField("A [[from here]] B", {type: "list"});
	expect(r.log).toEqual(["Renaming 'from here' to 'to there' in test field of tiddler 'test'"]);
});

it('ignores blank custom field settings', function() {
	testField("ignore", {type: "", ignored: true, from: "ignore"});
});

it('ignores unrecognized custom field settings', function() {
	testField("ignore", {type: "bizarre", ignored: true, from: "ignore"});
});

it('removes unnecessary brackets in custom list', function() {
	// The decision to remove brackets may be controversial, but since
	// list and tag automatically remove brackets on their own, I might
	// as well be consistent.
	testField("A [[from here]] B", "A to B", {type: "list", to: "to"});
	testField("A [[from]] B", "A to B",{type:"list", from:"from", to:"to"});
});

/**This is legacy support. The 'title' field type used to be called 'field'
 * But field was unhelpful. What's it mean when a field is set to 'field'?
 */
it('supports "field" field settings', function() {
	testField("from here", {type: "field"});
});

it('can filter for all impossible tiddlers', function() {
	function test(filter, expected) {
		var wiki = new $tw.Wiki(), result;
		wiki.addTiddlers(utils.setupTiddlers());
		wiki.addTiddlers([
			{title: "$:/plugins/flibbles/relink/language/Error/RelinkFilterOperator", text: "This text is pulled"},
			{title: "from"},
			{title: "A", list: "from"},
			{title: "B"},
			{title: "C", text: "[[from]]"}
		]);
		var warn = utils.collect("warn", function() {
			var log = utils.collect("log", function() {
				result = wiki.filterTiddlers(filter);
			});
			expect(log).toEqual([]);
		});
		expect(warn).toEqual([]);
		expect(result).toEqual(expected);
	};
	test("'bad]] t' +[relink:impossible[from]]", ["A"]);
	test("[relink:references[from]]", ["A", "C"]);
	test("[relink:nonexistent[]]", ["This text is pulled"]);
});

});

