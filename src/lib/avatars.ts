// Client-safe shape only — the actual fs-based directory scan lives in
// src/server/avatars/avatar-catalog.ts, unimportable from "use client".
export type AvatarOption = { id: string; src: string };
export type AvatarGroup = { name: string; options: AvatarOption[] };
