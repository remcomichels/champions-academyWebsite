// ─────────────────────────────────────────────────────────────────────────────
// renderSafeRichText
//
// renderRichText with the two injection vectors it leaves open closed off.
// Auto-imported by Nuxt (app/utils/).
//
// The resolver escapes text nodes and attribute values, so markup typed into a
// rich-text field renders as literal text — `<script>alert(1)</script>` comes
// out as &lt;script&gt;. Two things it does not escape:
//
//   1. A link's href is passed through verbatim, so `javascript:alert(1)` on a
//      link mark executes when the link is clicked.
//   2. A heading's `level` is interpolated straight into the tag name, so a
//      level of `1 onmouseover=alert(1)` injects an attribute into the <h1>.
//
// Both require CMS write access to reach, so this guards against a compromised
// editor account or a leaked management token rather than anonymous input.
// Sanitising the document beats sanitising the HTML here: no DOM is needed on
// the server, and it adds no dependency.
// ─────────────────────────────────────────────────────────────────────────────

import type { StoryblokRichTextNode } from "@storyblok/vue";

/** Protocols allowed in a rendered link. Anything else loses its href. */
const SAFE_PROTOCOL = /^(?:https?:|mailto:|tel:)/i;

interface RichTextNode {
	type?: string;
	attrs?: Record<string, unknown>;
	content?: RichTextNode[];
	marks?: RichTextNode[];
}

/**
 * An allowlist rather than a blocklist, deliberately: blocking "javascript:"
 * by name misses `JaVaScRiPt:` and the `java\nscript:` form, which browsers
 * strip whitespace out of before navigating.
 */
function isSafeHref(href: unknown): boolean {
	if (typeof href !== "string") return false;

	const value = href.trim();
	if (!value) return false;

	// Relative, root-relative, query and fragment links carry no protocol.
	if (/^[/#?.]/.test(value)) return true;

	return SAFE_PROTOCOL.test(value);
}

function sanitize(node: RichTextNode): RichTextNode {
	const clean: RichTextNode = { ...node };

	if (node.attrs) {
		const attrs = { ...node.attrs };

		if ((node.type === "link" || node.type === "anchor") && !isSafeHref(attrs.href)) {
			delete attrs.href;
		}

		// Interpolated into the tag name, so it has to reduce to a bare digit.
		if (node.type === "heading") {
			const level = Number(attrs.level);
			attrs.level = Number.isInteger(level) && level >= 1 && level <= 6 ? level : 1;
		}

		clean.attrs = attrs;
	}

	if (node.content) clean.content = node.content.map(sanitize);
	if (node.marks) clean.marks = node.marks.map(sanitize);

	return clean;
}

/**
 * Renders a Storyblok rich-text document to an HTML string, safe to pass to
 * v-html. Returns "" for an empty or missing document.
 */
export function renderSafeRichText(doc?: unknown): string {
	if (!doc || typeof doc !== "object") return "";

	// renderRichText is generic over its return type and infers {} through the
	// cast, so the string form is named explicitly.
	const safe = sanitize(doc as RichTextNode) as StoryblokRichTextNode<string>;
	return renderRichText<string>(safe) ?? "";
}
