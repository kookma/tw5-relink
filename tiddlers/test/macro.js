/*\

Tests macros.

\*/

var utils = require("test/utils");

function testText(text, expected, options) {
	[text, expected, options] = utils.prepArgs(text, expected, options);
	options.wiki.addTiddlers([
		utils.macroConf("test", "Btitle"),
		utils.macroConf("test", "Clist", "list"),
		utils.macroConf("test", "Dref", "reference"),
		{title: "testMacro", tags: "$:/tags/Macro",
		 text: "\\define test(A, Btitle, Clist, Dref) stuff\n"}
	]);
	var fields = Object.assign({text: text}, options.fields);
	var results = utils.relink(fields, options);
	expect(results.tiddler.fields.text).toEqual(expected);
	expect(results.fails.length).toEqual(options.fails || 0);
	return results;
};

describe("macro", function() {

it('argument orders', function() {
	testText("Macro <<test stuff 'from here' '[[from here]]' 'from here!!f'>>.");
	testText("Macro <<test stuff Clist:'[[from here]]' 'from here'>>.");
	testText("Macro <<test Btitle:'from here' stuff '[[from here]]'>>.");
	testText("Macro <<test Dref:'from here!!f' stuff 'from here'>>.");
	testText("Macro <<test Clist:'[[from here]]' stuff 'from here'>>.");
	testText("Macro <<test Dref:'from here!!f' Clist:'[[from here]]' stuff 'from here'>>.");
});

it("the '>' character", function() {
	// It's a tricky character. Allowed in some places, but not others
	// Allowed in standalone macrocalls
	testText("Macro <<test stuff My>val>>.", {from: "My>val", to: "to"});
	testText("Macro <<test stuff 'from here'>>.", "Macro <<test stuff 'My>val'>>.", {to: "My>val"} );
	testText("Macro <<test stuff from>>.", "Macro <<test stuff 'My>val'>>.", {from: "from", to: "My>val"});
});

it("doesn't choke if attribute string == macro name", function() {
	var wiki = new $tw.Wiki();
	wiki.addTiddler(utils.macroConf("jsontiddlers", "filter", "filter"));
	testText("<<jsontiddlers jsontiddlers>>", "<<jsontiddlers to>>",
	         {wiki: wiki, from: "jsontiddlers", to: "to"});
});

it('core javascript macros', function() {
	var wiki = new $tw.Wiki();
	wiki.addTiddler(utils.macroConf("jsontiddlers", "filter", "filter"));
	wiki.addTiddler(utils.macroConf("testmodulemacro", "param", "filter"));
	testText("<<jsontiddlers '[title[from here]]'>>", {wiki: wiki});
	// look in macro-module.js for the custom macro module we're calling
	testText("<<testmodulemacro '[title[from here]]'>>", {wiki: wiki});
});

it('whitespace', function() {
	testText("Macro <<test\n  d\n  'from here'\n  '[[from here]]'\n>>.");
	testText("<<test\r\nd\r\n'from here'\r\n'[[from here]]'\r\n>>\r\n");
	testText("Macro <<test Clist   :   '[[from here]]'>>.");
	testText("Macro\n\n<<test stuff 'from here' '[[from here]]'>>\n\n");
});

it('quotation for new value', function() {
	function test(value, quotedOut) {
		testText("<<test Btitle:from>>",
		         "<<test Btitle:"+quotedOut+">>",
		         {from: "from", to: value});
	};
	test("cd", "cd");
	test("c\"\"' ]d", `"""c\"\"' ]d"""`);
	test('c"""\' d', '[[c"""\' d]]');
	test('c"""\' d', '[[c"""\' d]]');
	test('c""" ]d', '\'c""" ]d\'');
});

it('quotation of originalValue', function() {
	testText("<<test Btitle:'from here'>>");
	testText("<<test Btitle:[[from here]]>>");
	testText('<<test Btitle:"from here">>');
	testText("<<test Btitle:from>>", "<<test Btitle:'to there'>>", {from: "from"});
	testText("<<test Btitle:    from    >>", {from: "from", to: "to"});
	testText('<<test Btitle:"""from here""">>');
	// Trick title. Old param parser choked on this.
	testText('<<test Btitle:from]] >>', {from: "from]]", to: "tothere"});
});

it('unquotable titles', function() {
	var to = `to''[]there"`;
	var ph = utils.placeholder;
	testText("Macro <<test stuff 'from here'>>.", ph(1,to)+"Macro <$macrocall $name=test A=stuff Btitle=<<relink-1>>/>.", {to: to});
	testText("<$link to=<<test stuff 'from here'>> />", {fails: 1, ignored: true, to: to});

	// This one is tricky because an unrelated attribute can't be quoted
	// the way it was in a macro invocation
	testText('X<<test A:g>t "from here">>Y', ph(1,to)+"X<$macrocall $name=test A='g>t' Btitle=<<relink-1>>/>Y", {to: to});

	// Even if the toTitle is okay. It can make a list unquotable
	var apos = "M[]'s";
	testText('X<<test Clist: \'[[from here]] C"\'>>Y',
	         ph("list-1",apos+' C"')+'X<$macrocall $name=test Clist=<<relink-list-1>>/>Y',
	         {to: apos});
});

it('undefined macros', function() {
	// Relink will try it's best to tolerate macro settings that have
	// no coreesponding macro definition, but it'll fail if there's a
	// chance it's not relinking when it should.
	var wiki = new $tw.Wiki();
	wiki.addTiddler(utils.macroConf("undef", "param", "title"));
	testText("<<undef something>> [[from here]]", {wiki: wiki});
	testText("<<undef param:'from here'>>", {wiki: wiki});
	testText("<<undef A B C D param:'from here'>>", {wiki: wiki});
	testText("<<undef 'from here'>>", {wiki: wiki,ignored: true,fails: 1});
	var to = `to''[]there"`;
	testText("<<undef param:'from here'>>", utils.placeholder(1,to)+"<$macrocall $name=undef param=<<relink-1>>/>", {wiki: wiki, to: to});
	testText("<<undef something param:'from here'>>",
	         {wiki: wiki, to: to, ignored: true, fails: 1});
});

it('imported macros', function() {
	function test(text, options) {
		var wiki = new $tw.Wiki();
		wiki.addTiddlers([
			utils.macroConf("other", "param", "title"),
			utils.macroConf("ptr", "tiddler", "title"),
			utils.attrConf("$importvariables", "filter", "filter"),
			{title: "otherTiddler", text: "\\define other(A, param) X\n"},
			{title: "ptr", tags: "$:/tags/Macro", text: "\\define ptr(tiddler) $tiddler$\n"},
			{title: "otherRef", pointer: "otherTiddler"},
			{title: "newTest", text: "\\define test(Dref) X\n"}
		]);
		options = Object.assign({wiki: wiki}, options);
		testText(text, options);
	};
	test("\\import otherTiddler\n\n<<other Z [[from here]]>>");
	test("<$importvariables filter='otherTiddler'><<other Z [[from here]]>></$importvariables>");
	test("<$importvariables filter={{otherRef!!pointer}}><<other Z [[from here]]>></$importvariables>");
	test("<$importvariables filter={{{[all[current]get[pointer]]}}}><<other Z [[from here]]>></$importvariables>", {fields: {pointer: "otherTiddler"}});
	test("<$importvariables filter={{!!pointer}}><<other Z [[from here]]>></$importvariables>", {fields: {pointer: "otherTiddler"}});
	test("<$importvariables filter=<<ptr otherTiddler>>><<other Z [[from here]]>></$importvariables>");
	// If macro not imported. Arguments aren't resolved
	test("<<other Z [[from here]]>>", {ignored: true, fails: 1});
	// But arguments can be resolved anyway if they're named
	test("<<other Z param:[[from here]]>>");
	//imported takes priority over global
	test("\\import newTest\n\n<<test 'from here##index'>>");
	test("<$importvariables filter=newTest><<test 'from here##index'>></$importvariables>");
	//imported doesn't take priority if it's not imported though
	test("<<test Z 'from here'>>");
	//And importing something else doesn't goof up the lookup chain
	test("\\import otherTiddler\n\n<<test Z 'from here'>>");
	test("<$importvariables filter='otherTiddler'>\n\n<<test Z 'from here'>>\n\n</$importvariables>");

	// These are for when the importvariables needs updating before it
	// can be referenced. A rare scenario, but it could happen.
	test("\\import otherTiddler\n\n<<other Z otherTiddler>>", {from: "otherTiddler", to: "tothere"});
	test("<$importvariables filter='otherTiddler'><<other Z otherTiddler>></$importvariables>", {from: "otherTiddler", to: "toThereAgain"});
	test("<$importvariables filter={{otherRef!!pointer}}><<other Z otherRef>></$importvariables>", {from: "otherRef", to: "toThereAgain"});
	test("<$importvariables filter=<<ptr otherTiddler>>><<other Z otherTiddler>></$importvariables>", {from: "otherTiddler", to: "toThereAgain"});
});

it('local macros', function() {
	function test(text, options) {
		var wiki = new $tw.Wiki();
		wiki.addTiddlers([
			utils.macroConf("method", "Btitle", "title")
		]);
		options = Object.assign({wiki: wiki}, options);
		testText(text, options);
	};
	test("\\define method(A, Btitle, C) stuff\n\n<<method X 'from here'>>");
	// Can override existing macros
	test("\\define test(Dref) stuff\n\n<<test 'from here##index'>>");
});

it('slashes in macro name', function() {
	// non/attr is a legal macro name, but not a legal
	// unquoted attribute
	// Also, it might goof up our settings system
	var wiki = new $tw.Wiki();
	var to = `to''[]there"`;
	wiki.addTiddler(utils.macroConf("non/attr", "param", "title"));
	testText('X<<non/attr param:"from here">>Y', utils.placeholder(1,to)+"X<$macrocall $name='non/attr' param=<<relink-1>>/>Y", {to: to, wiki: wiki});
});

it('$macrocall', function() {
	testText("<$macrocall $name=test A=stuff Btitle='from here' Clist='[[from here]]' Dref='from here##index' />");
	testText("\n\n<$macrocall $name=test\n\nBtitle='from here'/>\n\n");
});

it('attribute invocations', function() {
	testText("Before <$a b=<<test stuff 'from here'>>/> After");
	testText("Before <$a b   =    <<test stuff 'from here'>> /> After");
	testText("Before <$a b\n=\n<<test stuff 'from here'>>\n/> After");
});

it('keeps up to date with macro changes', function() {
	var wiki = new $tw.Wiki();
	var t = testText("Macro <<test stuff 'from here'>>.", {wiki: wiki});
	var oldTick = $tw.utils.nextTick;
	try {
		$tw.utils.nextTick = function(fn) {fn()};
		wiki.eventsTriggered = false;
		wiki.addTiddler({ title: "testMacro", tags: "$:/tags/Macro",
			text: "\\define test(Btitle) title is first now\n"});
	} finally {
		$tw.utils.nextTick = oldTick;
	}

	// Btitle is the first argument now. Relink should realize that.
	// DON'T USE testText, because that'll reoverwrite the new testMacro
	t = utils.relink({text: "Macro <<test 'from here'>>."}, {wiki: wiki});
	expect(t.tiddler.fields.text).toEqual("Macro <<test 'to there'>>.");
});

});
