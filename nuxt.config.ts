// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-05-15',
  devtools: { enabled: true },

  modules: [
    '@nuxt/eslint',
    '@nuxt/fonts',
    '@nuxt/icon',
    '@nuxt/image',
    '@nuxtjs/seo',
    '@nuxt/scripts',
    '@nuxtjs/i18n',
    '@storyblok/nuxt',
    '@vueuse/nuxt',
  ],

  /* -----------------------------
  * Components auto-import
  * ----------------------------- */
  components: {
    dirs: [
      {
        path: "~/components",
        prefix: "Nuxt",
      },
      {
        path: "~/components/storyblok",
        global: true,
      },
    ],
  },

  /* -----------------------------
	 * Global styles (LESS only)
	 * ----------------------------- */
	css: [
		"~/assets/less/fonts.css",
		"~/assets/less/main.less",
	],

	/* -----------------------------
	 * Site metadata
	 * ----------------------------- */
	site: {
		url: process.env.NUXT_PUBLIC_SITE_URL || "https://localhost:3000/",
		name: "Nuxt Template",
		description: "Nuxt Template for building applications with Storyblok.",
	},

	ogImage: {
		enabled: false,
	},

	app: {
		head: {
			titleTemplate: '%s',
			link: [
				{
					rel: "icon",
					type: "image/png",
					sizes: "96x96",
					href: "/favicon-96x96.png",
				},
				{
					rel: "icon",
					type: "image/svg+xml",
					href: "/favicon.svg",
				},
				{
					rel: "shortcut icon",
					href: "/favicon.ico",
				},
				{
					rel: "apple-touch-icon",
					sizes: "180x180",
					href: "/apple-touch-icon.png",
				},
				{
					rel: "manifest",
					href: "/site.webmanifest",
				},
			],
			meta: [
				{
					name: "Nuxt Site Name",
					content: "Nuxt Site Name",
				},
				{
					name: "color-scheme",
					content: "light",
				},
				{
					"http-equiv": "color-scheme", // Samsung Internet / older Android
					content: "light",
				},
			],
		},
	},

	/* -----------------------------
	* Runtime config
	* ----------------------------- */
	runtimeConfig: {
		bunnyStreamApiKey: process.env.BUNNY_STREAM_API_KEY,
    	bunnyStreamLibraryId: process.env.BUNNY_STREAM_LIBRARY_ID,

		public: {
			supabaseUrl: process.env.SUPABASE_URL || "",
			supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
			supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
			storyblokApiKey: process.env.STORYBLOK_DELIVERY_API_TOKEN || "",
			bunnyStreamHostname: process.env.BUNNY_STREAM_HOSTNAME || "",
			googleAnalyticsId: process.env.NUXT_PUBLIC_GOOGLE_ANALYTICS_ID || "",
		},
	},

  /* -----------------------------
	 * Vite (LESS)
	 * ----------------------------- */
	vite: {
		css: {
			preprocessorOptions: {
				less: {
					javascriptEnabled: true,

					// Global LESS imports
					additionalData: `
						@import "~/assets/less/_variables.less";
						@import "~/assets/less/_mixins.less";
						@import "~/assets/less/_constants.less";
					`,
				},
			},
		},
	},

  /* -----------------------------
   * TypeScript (Nuxt 4 best practice)
   * ----------------------------- */
  typescript: {
    strict: true,
    typeCheck: true,
  },

  /* -----------------------------
   * i18n
   * ----------------------------- */
  i18n: {
    strategy: "prefix_except_default",
    locales: [
      { code: "en", iso: "en-US" },
    ],
    defaultLocale: "en",
  },

  /* -----------------------------
	 * Nuxt Image
	 * ----------------------------- */
	image: {
		provider: "storyblok",
		storyblok: {
			baseURL: "https://a.storyblok.com",
			modifiers: {
				filters: {
					quality: '80',
				}
			}
		},
		screens: {
			sm: 580,
			md: 1080,
			lg: 1440,
		},
		inject: true,
	},

	/* -----------------------------
	 * Schema.org
	 * ----------------------------- */
	schemaOrg: {
		identity: {
			type: "Organization",
			name: "Website Name",
			logo: "/images/logo.png", //Routes to public/images
			description: "Website description here",
			telephone: "+310612345678",
			email: "email@example.com",
			address: {
				streetAddress: "street 1",
				postalCode: "1234 AB",
				addressLocality: "City",
				addressCountry: "NL",
			},
			sameAs: [
				"https://www.linkedin.com/company/templatelink/",
				"https://www.instagram.com/templatelink/",
				"https://www.facebook.com/templatelink",
			],
		},
	},

	/* -----------------------------
	* Nitro
	* ----------------------------- */
	nitro: {
		routeRules: {
			// JS/CSS bundles — hashed filenames, safe to cache forever
			'/_nuxt/**': {
			headers: {
				'cache-control': 'public, max-age=31536000, immutable'
			}
			},
			// Storyblok powered pages — cache 10 mins, serve stale for 1 hour while revalidating
			'/**': {
			headers: {
				'cache-control': 's-maxage=600, stale-while-revalidate=3600',
				// Clickjacking protection that still lets the Storyblok visual editor frame the site.
				'content-security-policy': "frame-ancestors 'self' https://app.storyblok.com",
				// Stop MIME-type sniffing, limit referrer leakage, lock down powerful browser APIs.
				'x-content-type-options': 'nosniff',
				'referrer-policy': 'strict-origin-when-cross-origin',
				'permissions-policy': 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
				// Force HTTPS for a year (ignored on http/localhost).
				'strict-transport-security': 'max-age=31536000; includeSubDomains'
			}
			},
			// Storyblok preview — never cache so editors always see live changes
			'/api/_storyblok/**': {
			headers: {
				'cache-control': 'no-store'
			}
			},
		}
	},

    /* -----------------------------
	 * Scripts
	 * ----------------------------- */
	scripts: {
		registry: {
			googleAnalytics: {
      			id: process.env.NUXT_PUBLIC_GOOGLE_ANALYTICS_ID,
			},
		},
	},

	/* -----------------------------
	* Robots
	* ----------------------------- */
	robots: {
		groups: [
			{
				userAgent: ['*'],
				disallow: process.env.NUXT_PUBLIC_SITE_URL === 'https://localhost:3000/'
					? ['/api/', '/login']
					: ['/', '/login'],
			},
		],
	},

	/* -----------------------------
	 * Sitemap
	 * ----------------------------- */
	sitemap: {
		autoI18n: false,
		urls: [
			{
				loc: '/sitemap-test',
				changefreq: 'monthly',
				priority: 0.5,
			},
		],
	},

	/* -----------------------------
	* Storyblok
	* ----------------------------- */
	storyblok: {
		accessToken: process.env.STORYBLOK_DELIVERY_API_TOKEN,
		apiOptions: {
			region: "eu",
		},
		componentsDir: "~/components/storyblok",
	},
});