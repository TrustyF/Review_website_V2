import stylelint from "stylelint";

// Sass counterpart of eslint-rules/comment-length.mjs: same 3-line/4+-line warn
// thresholds. Scans raw source lines instead of an AST — see raw-text-syntax.mjs.
const ruleName = "sass-comment-length/flag-long";
const messages = stylelint.utils.ruleMessages(ruleName, {
	tooLong: (lines) => `Comment is ${lines} lines long — consider trimming it to 2 or fewer.`,
});

const COMMENT_LINE = /^(\s*)\/\//;

const rule = (enabled) => (root, result) => {
	if (!enabled) return;

	const lines = root.source.input.css.split(/\r\n|\n/);
	const comments = [];
	for (let lineNo = 1; lineNo <= lines.length; lineNo++) {
		const match = lines[lineNo - 1].match(COMMENT_LINE);
		if (match) comments.push({ line: lineNo, column: match[1].length + 1 });
	}

	let i = 0;
	while (i < comments.length) {
		let j = i;
		while (
			j + 1 < comments.length &&
			comments[j + 1].line === comments[j].line + 1 &&
			comments[j + 1].column === comments[i].column
		) {
			j++;
		}
		const blockLines = j - i + 1;
		if (blockLines >= 3) {
			stylelint.utils.report({
				message: messages.tooLong(blockLines),
				node: root,
				result,
				ruleName,
				start: { line: comments[i].line, column: comments[i].column },
				end: { line: comments[j].line, column: lines[comments[j].line - 1].length + 1 },
			});
		}
		i = j + 1;
	}
};

rule.ruleName = ruleName;
rule.messages = messages;

export default stylelint.createPlugin(ruleName, rule);
