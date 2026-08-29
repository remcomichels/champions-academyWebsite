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
  {
    // Company-wide Whop calls must never be reachable from a route that serves
    // one affiliate. The failure mode is silent — one affiliate seeing another's
    // figures looks exactly like working code — so it is enforced here rather
    // than left to review.
    files: ['server/api/affiliate/**', 'server/api/auth/**', 'server/middleware/**'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['**/whopAdmin', '**/utils/whopAdmin', '~/server/utils/whopAdmin'],
          message:
            'whopAdmin is company-wide and admin-only. Affiliate-scoped reads belong in server/utils/whop.ts.',
        }],
      }],
    },
  },
)
