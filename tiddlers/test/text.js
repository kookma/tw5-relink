/*\

Tests the new relinking wiki methods.

\*/

var utils = require("test/utils");
var relink = utils.relink;

describe("text", function() {

function attrConf(element, attribute, type) {
	var prefix = "$:/config/flibbles/relink/attributes/";
	return {title: prefix + element + "/" + attribute, text: type};
};

function testText(text, expected, options) {
	[text, expected, options] = utils.prepArgs(text, expected, options);
	var prefix = "$:/config/flibbles/relink/attributes/";
	options.wiki.addTiddlers([
		attrConf("$link", "to", "title"),
		attrConf("$list", "filter", "filter"),
	]);
	var t = relink({text: text}, options);
	expect(t.fields.text).toEqual(expected);
};

it('allows all other unmanaged wikitext rules', function() {
	function fine(text) { testText(text + " [[from here]]"); };
	fine("This is ordinary text");
	fine("This is a WikiLink here");
	fine("This \n*is\n*a\n*list");
	fine("Image: [img[https://google.com]] and [img[Title]] here");
	fine("External links: [ext[https://google.com]] and [ext[Tooltip|https://google.com]] here");
	fine("Comments <!-- Look like this -->");
	fine("Block Comments\n\n<!--\n\nLook like this? -->\n\n");
	fine("\\define macro() Single line stuff\n");
	fine("\\define macro()\nMultiline stuff\n\\end\n");
});

it('ignores titles in generic text', function() {
	testText("This is from here to elsewhere", {ignored: true});
});

it('prettylinks ignore plaintext files', function() {
	var wiki = new $tw.Wiki();
	var text = "This is [[from here]] to there.";
	var t = relink({text: text, type: "text/plain"}, {wiki: wiki});
	expect(t.fields.text).toEqual(text);
});

it('handles managed rules inside unmanaged rules', function() {
	testText("List\n\n* [[from here]]\n* Item\n");
	testText("<div>\n\n[[from here]]</div>");
	testText("<!--\n\n[[from here]]-->", {ignored: true});
});

it('prettylinks', function() {
	testText("Link to [[from here]].");
	testText("Link to [[description|from here]].");
	testText("Link to [[weird]desc|from here]].");
	testText("Link to [[it is from here|from here]].", "Link to [[it is from here|to there]].");
	testText("Link [[new\nline|from here]].", "Link [[new\nline|from here]].");
	testText("Link to [[elsewhere]].");
	testText("Link to [[desc|elsewhere]].");
	testText("Multiple [[from here]] links [[description|from here]].");
});

it('transcludes', function() {
	testText("{{from here}}")
	testText("Before {{from here}} After")
	testText("Before {{from here||template}} After")
	testText("Before {{title||from here}} After")
	testText("Before {{||from here}} After")
	testText("Before {{from here||from here}} After")
	testText("Before\n\n{{from here||template}}\n\nAfter")
	testText("Before {{  from here  }} After")
	testText("Before {{  from here  ||  from here  }} After")
	testText("Before {{||  from here  }} After")
	testText("{{elsewhere}}", {ignored: true})
});

it('field attributes', function() {
	testText('<$link to="from here">caption</$link>');
	testText('<$link to="from here">\n\ncaption</$link>\n\n');
	testText(`<$link to='from here'>caption</$link>`);
	testText(`<$link to='from here' />`);
	testText('Before <$link to="from here">caption</$link> After');
	testText(`<$link tag="div" to="from here">caption</$link>`);
	testText(`<$link aria-label="true" to="from here">caption</$link>`);
	testText(`<$link to='from here'>caption</$link><$link to="from here">another</$link>`);
	testText(`<$link to='from here'>caption</$link>In between content<$link to="from here">another</$link>`);
	testText(`<$link to    =   "from here">caption</$link>`);
	testText("<$link\nto='from here'>caption</$link>");
	testText("<$link to='from here'\n/>");
	testText("<$link\ntag='div'\nto='from here'>caption</$link>");
	testText("<$link\n\ttag='div'\n\tto='from here'>caption</$link>");
	testText(`Beginning text <$link to="from here">caption</$link> ending`);
	// extra tricky
	testText(`<$link tooltip="link -> dest" to="from here" />`);
	// ignores
	testText(`<$link >to="from here"</$link>`, {ignored: true});
	testText(`<$link to="from here"`, {ignored: true});
	testText(`<$LINK to="from here" />`, {ignored: true});
	testText(`<$link TO="from here" />`, {ignored: true});
	testText(`<$link to=<<from>> />`, {from: "from", ignored: true});
});

it('field attributes with true', function() {
	testText(`<$link trueAttr to="from here">caption</$link>`);
	testText(`<$link to />`);
	testText(`<$link to />`, {from: "true"});
	testText(`<$link to/> <$link to=true/>`, `<$link to/> <$link to='to there'/>`, {from: "true"});
	testText(`<$link to /> <$link to=true />`, `<$link to /> <$link to='to there' />`, {from: "true"});
	testText(`<$link to       /> <$link to=true />`, `<$link to       /> <$link to='to there' />`, {from: "true"});
});

it('field attributes fun with quotes', function() {
	function testQuote(from, to, options) {
		testText(`<$link to=${from}/>`, `<$link to=${to}/>`, options);
	};
	testQuote(`"""from here"""`, `"""to there"""`);
	testQuote(`from`, `'to there'`, {from: "from"});
	testQuote(`from`, `"Jenny's"`, {from: "from", to: "Jenny's"});
	testQuote(`'"good" boy'`, `"cat's"`, {from: '"good" boy', to: "cat's"});
	testQuote(`"""from here"""`, `'love """ hate'`, {to: 'love """ hate'});

	// It prefers quoteless when given quoteless, but only when possible.
	testQuote(`love`, `hate`, {from: "love", to: "hate"});
	testQuote(`love`, `"lover's"`, {from: "love", to: "lover's"});
	$tw.utils.each('= <>/"\n\t', function(ch) {
		testQuote(`A`, `'te${ch}st'`, {from: "A", to: `te${ch}st`});
	});

	// Now for the super advanced quotes!! //
	testQuote("from", `""""begins" with quote; has apos'"""`, {from: "from", to: `"begins" with quote; has apos'`});
});

it('uses macros for literally unquotable titles', function() {
	var to = 'End\'s with "quotes"';
	var to2 = 'Another\'"quotes"';
	var macro = '\\define relink-1() '+to+'\n';
	var macro2 = '\\define relink-1() '+to2+'\n';
	var expectedLink = '<$link to=<<relink-1>>/>';
	testText("<$link to='from here'/>", macro+expectedLink, {to: to});
	testText("Before <$link to='from here'/> After",
	         macro+"Before "+expectedLink+" After", {to: to});
	// It'll prefer triple-quotes, but it should still resort to macros.
	testText('<$link to="""from here"""/>', macro+expectedLink, {to: to});
	// Only one macro is made, even when multiple instances occur
	testText("<$link to='from here'/><$link to='from here'/>",
		 macro+expectedLink+expectedLink, {to: to});
	// Running it twice still works
	testText(macro+expectedLink, macro2+expectedLink, {from: to, to: to2, debug: true});
});

it('ignores blank attribute configurations', function() {
	var wiki = new $tw.Wiki();
	wiki.addTiddlers(attrConf("$transclude", "tiddler", ""));
	testText(`<$link to="A" /><$transclude tiddler="A" />`,
	         `<$link to="to there" /><$transclude tiddler="A" />`,
	         {wiki: wiki, from: "A"});
});

it('ignores unrecognized attribute configurations', function() {
	var wiki = new $tw.Wiki();
	wiki.addTiddler(attrConf("$transclude", "tiddler", "kablam"));
	testText(`<$link to="A" /><$transclude tiddler="A" />`,
	         `<$link to="to there" /><$transclude tiddler="A" />`,
	         {wiki: wiki, from: "A"});
});

/**This is legacy support. The 'title' field type used to be called 'field'
 * But field didn't make sense in many contexts.
 */
it('supports "field" attribute configuration', function() {
	var wiki = new $tw.Wiki();
	wiki.addTiddler(attrConf("$transclude", "tiddler", "field"));
	testText(`<$transclude tiddler="from here" />`, {wiki: wiki});
});

it('filter attributes', function() {
	var prefix = "$:/config/flibbles/relink/";
	var wiki = new $tw.Wiki();
	wiki.addTiddlers([
		attrConf("$list", "filter", "filter"),
		{title: prefix + "operators/title", text: "yes"}
	]);
	testText(`<$list filter="A [[from here]] B" />`, {wiki: wiki});
	testText(`<$list nothing="A [[from here]] B" />`, {wiki: wiki, ignored: true});
});

});
