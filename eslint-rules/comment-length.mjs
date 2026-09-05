// Caps comment length: 3-line blocks warn, 4+ line blocks warn harder.
// Adjacent same-indent `//` lines count as one block; `/* */` spans itself.
function createRule(check) {
	return {
		meta: { type: "suggestion", schema: [] },
		create(context) {
			return {
				Program() {
					const sourceCode = context.sourceCode ?? context.getSourceCode();
					const comments = sourceCode.getAllComments();

					let i = 0;
					while (i < comments.length) {
						const comment = comments[i];

						if (comment.type === "Line") {
							let j = i;
							while (
								j + 1 < comments.length &&
								comments[j + 1].type === "Line" &&
								comments[j + 1].loc.start.line === comments[j].loc.end.line + 1 &&
								comments[j + 1].loc.start.column === comment.loc.start.column
							) {
								j++;
							}
							check(context, comments[i].loc.start, comments[j].loc.end, j - i + 1);
							i = j + 1;
						} else {
							const lines = comment.loc.end.line - comment.loc.start.line + 1;
							check(context, comment.loc.start, comment.loc.end, lines);
							i++;
						}
					}
				},
			};
		},
	};
}

export const rules = {
	"flag-long": createRule((context, start, end, lines) => {
		if (lines === 3) {
			context.report({
				loc: { start, end },
				message: "Comment is 3 lines long — consider trimming it to 2 or fewer.",
			});
		}
	}),
	"no-very-long": createRule((context, start, end, lines) => {
		if (lines > 3) {
			context.report({
				loc: { start, end },
				message: `Comment is ${lines} lines long — comments over 3 lines are not allowed, split the explanation or move it out of the comment.`,
			});
		}
	}),
};
