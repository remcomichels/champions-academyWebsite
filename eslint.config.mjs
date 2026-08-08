// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
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
