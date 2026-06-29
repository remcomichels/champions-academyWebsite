// Define custom error messages and templates
export const errorTemplates = {
	400: {
		title: "400 - Bad Request",
		message: "The request was malformed or invalid. Please check your input and try again.",
		cta: {
			text: "Go Back",
			link: "javascript:history.back()",
		},
	},
	401: {
		title: "401 - Unauthorized",
		message: "You need to be logged in to access this resource.",
		cta: {
			text: "Log In",
			link: "/login",
		},
	},
	404: {
		title: "404 - Page Not Found",
		message: "The page you're looking for doesn't exist or has been moved.",
		cta: {
			text: "Return to Home",
			link: "/",
		},
	},
	422: {
		title: "422 - Unprocessable Entity",
		message: "The request was unacceptable, often due to missing or invalid parameters.",
		cta: {
			text: "Try Again",
			link: "",
		},
	},
	429: {
		title: "429 - Too Many Requests",
		message: "You've made too many requests too quickly. Please slow down and try again later.",
		cta: {
			text: "Retry",
			link: "",
		},
	},
	500: {
		title: "500 - Internal Server Error",
		message: "Something went wrong on our end. Please try again later.",
		cta: {
			text: "Refresh Page",
			link: "",
		},
	},
	502: {
		title: "502 - Bad Gateway",
		message: "The server received an invalid response from another server.",
		cta: {
			text: "Try Again",
			link: "",
		},
	},
	503: {
		title: "503 - Service Unavailable",
		message: "The server is temporarily unavailable. Please try again later.",
		cta: {
			text: "Retry",
			link: "",
		},
	},
	504: {
		title: "504 - Gateway Timeout",
		message: "The server did not receive a timely response from another server.",
		cta: {
			text: "Try Again",
			link: "",
		},
	},
	default: {
		title: "Oops!",
		message: "An unexpected error occurred.",
		cta: {
			text: "Go Home",
			link: "/",
		},
	},
};

// utils/error.ts

type ErrorAction = "reload" | "goHome" | "contactSupport";

export const getErrorTemplate = <T>(
	statusCode: number,
	errorTemplates: Record<number | "default", T>,
): T => {
	return errorTemplates[statusCode] ?? errorTemplates.default;
};

export const handleCtaClick = (
	ctaLink?: string,
	action?: ErrorAction,
): void => {
	if (action) {
		switch (action) {
			case "reload":
				window.location.reload();
				return;

			case "goHome":
				navigateTo("/");
				return;

			case "contactSupport":
				navigateTo("/contact");
				return;
		}
	}

	if (ctaLink) {
		navigateTo(ctaLink);
		return;
	}

	window.location.reload();
};
