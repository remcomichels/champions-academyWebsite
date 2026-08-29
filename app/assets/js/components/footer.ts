import { useConfig } from "#imports";

// Footer content lives in the config story (same source as the header menu),
// fetched once per request by the shared useConfig() composable.
export function useFooter() {
	const { footer } = useConfig();

	return { footer };
}
