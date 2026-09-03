// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    // Claude Code checks worktrees out inside the repo. They are full copies of
    // this project, so linting them reports every problem twice — once against
    // a path nobody is editing — and a stale branch can fail CI for code that
    // is not on the branch under test.
    // The Storyblok CLI writes these from the space's block schema. They are
    // generated output, not code anyone edits, and they trip no-explicit-any
    // and no-unused-vars in ways no fix can survive the next regeneration.
    ignores: ['.claude/**', '.storyblok/**'],
  },
)
