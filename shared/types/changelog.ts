/**
 * What a changelog entry is, and the four things one can be.
 *
 * Shared because the set is enforced in three places that must not drift: a
 * check constraint in the database, `oneOf()` on the write endpoint, and the
 * picker in the admin form. The slugs are what the column stores and are
 * therefore permanent; the labels are display text and can be reworded freely.
 */

/**
 * Deliberately four, and deliberately closed.
 *
 * A free-text tag would have drifted into "Fix", "Bugfix" and "Fixes" inside a
 * month, and a pill that cannot be relied on to say the same word twice cannot
 * be colour-coded or filtered on. Adding a fifth is one migration and one line
 * here.
 */
export type ChangelogKind = "feature" | "improvement" | "fix" | "breaking";

export const CHANGELOG_KINDS = ["feature", "improvement", "fix", "breaking"] as const;

/**
 * Label and pill tone per kind, in the order the admin picker offers them —
 * best news first, and the one that costs the reader something last.
 *
 * `tone` is a class suffix rather than a colour: the public page and the admin
 * list draw these from two different colour systems (the marketing palette and
 * the dashboard's theme tokens), so the only thing they can share is the name
 * of the meaning.
 */
export const CHANGELOG_LABELS: Record<ChangelogKind, string> = {
	feature: "New feature",
	improvement: "Improvement",
	fix: "Bug fix",
	breaking: "Breaking change",
};

export interface ChangelogEntry {
	id: number;
	/** ISO timestamp — `published_at`, which is the date the entry is *about*. */
	at: string;
	kind: ChangelogKind;
	title: string;
	body: string;
}
