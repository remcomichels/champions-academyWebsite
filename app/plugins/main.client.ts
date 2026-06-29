// plugins/main.client.js
import { initGlobalInteractions } from "~/assets/js/main";

export default defineNuxtPlugin((nuxtApp) => {
	const run = (): void => {
		initGlobalInteractions();
	};

	run();
	nuxtApp.hook("page:finish", () => {
		requestAnimationFrame(() => run());
	});
});
