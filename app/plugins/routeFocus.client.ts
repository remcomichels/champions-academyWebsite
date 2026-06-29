export default defineNuxtPlugin(() => {
	const router = useRouter();

	// Move keyboard focus to the main landmark after each client-side navigation.
	// On an SPA the link you clicked is unmounted, so focus would otherwise fall
	// back to <body> and the next Tab would start from the top of the page. This
	// lands focus on the new page's content instead. <NuxtRouteAnnouncer> (in
	// app.vue) handles the spoken announcement for screen readers.
	router.afterEach((to, from) => {
		if (!from || to.path === from.path) return;
		nextTick(() => {
			document.getElementById("main")?.focus();
		});
	});
});
