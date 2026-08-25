// Client-safe shape only — the actual directory scan
// (src/server/avatars/avatar-catalog.ts) needs fs, which a "use client"
// module can't import even indirectly (see crop-shapes.ts's own note on the
// same split).
export type AvatarOption = { id: string; src: string };
export type AvatarGroup = { name: string; options: AvatarOption[] };
