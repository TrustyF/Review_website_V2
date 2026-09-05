import { createRequire } from "module";
import path from "path";

// comment-length.mjs reads raw text, not an AST, so this skips real parsing.
// Root/Input must be stylelint's own bundled postcss, or its instanceof checks fail.
const require = createRequire(import.meta.url);
let stylelintDir = path.dirname(require.resolve("stylelint"));
while (path.basename(stylelintDir) !== "stylelint") stylelintDir = path.dirname(stylelintDir);
const { Input, Root } = require(path.join(stylelintDir, "node_modules", "postcss"));

const rawTextSyntax = {
	parse(css, opts) {
		const input = new Input(css, opts);
		const root = new Root();
		root.source = { input, start: { line: 1, column: 1 } };
		return root;
	},
	stringify(root) {
		return root.source.input.css;
	},
};

export default rawTextSyntax;
