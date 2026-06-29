import type { RouterConfig } from '@nuxt/schema';

export default {
	scrollBehavior() {
		return { top: 0, left: 0 };
	},
} satisfies RouterConfig;
