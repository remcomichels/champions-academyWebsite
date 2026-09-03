import type { SbBlokData } from "@storyblok/vue";

// ─────────────────────────────────────────────────────────────────────────────
// asBlok
//
// Hands a child blok to <StoryblokComponent>. Auto-imported by Nuxt (app/utils/).
//
// The generated block types are produced with --strict, so they carry no string
// index signature and an unknown field is a compile error — which is the whole
// point of generating them. SbBlokData, the prop <StoryblokComponent> takes, is
// defined by its index signature, so a strict blok is not assignable to it.
//
// The cast is safe in the one direction it is used: everything in a `bloks`
// field is a blok. Keeping it in a named helper means the assertion appears
// once, rather than being spelled out in fourteen templates.
// ─────────────────────────────────────────────────────────────────────────────

export function asBlok(value: unknown): SbBlokData {
	return value as SbBlokData;
}
