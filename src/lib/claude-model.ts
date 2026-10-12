// Pinned on purpose: new versions can change API behavior, so bump them deliberately.
// Translations (review bodies + i18n script) — where voice matters most.
export const CLAUDE_MODEL = "claude-opus-5-5";
// Review proofreading — grammar fixes don't need Opus, and Haiku is ~40x cheaper.
export const CLAUDE_PROOFREAD_MODEL = "claude-haiku-5-5";
