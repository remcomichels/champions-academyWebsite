// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    // Claude Code checks worktrees out inside the repo. They are full copies of
    // this project, so linting them reports every problem twice — once against
    // a path nobody is editing — and a stale branch can fail CI for code that
    // is not on the branch under test.
    ignores: ['.claude/**'],
  },
)
