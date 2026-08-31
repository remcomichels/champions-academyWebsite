// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-05-15',
  devtools: { enabled: true },

  modules: [
    '@nuxt/eslint',
    '@nuxt/fonts',
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
  * Storyblok block name aliases
  * ----------------------------- */
  hooks: {
    // @storyblok/vue checks whether a block is registered by calling
    // resolveComponent() with the raw name from the CMS ("hero_block"), but
    // renders the underscores-to-dashes version ("hero-block"). Nuxt registers
    // the PascalCase name ("HeroBlock"), which only the dashed form resolves
    // to — so blocks render correctly while the check logs a false
    // "Component could not be found" error. Registering the snake_case name as
    // an extra alias makes the check pass.
    "components:extend"(components) {
      const aliases = [];

      for (const component of components) {
        if (!component.filePath.includes("/components/storyblok/")) continue;

        const fileName = component.filePath.split("/").pop()?.replace(/\.vue$/, "");
        if (!fileName?.includes("_")) continue;
        if (components.some(c => c.pascalName === fileName)) continue;

        aliases.push({ ...component, pascalName: fileName, kebabName: fileName });
      }

      components.push(...aliases);
    },
  },

  /* -----------------------------
	 * Global styles (LESS only)
	 * ----------------------------- */
	css: [
		"~/assets/less/fonts.css",
		"~/assets/less/main.less",
	],

	/* -----------------------------
	 * Fonts
	 * @nuxt/fonts downloads and self-hosts any family it can resolve, so Anton
	 * and Alex Brush need no setup — referencing them in LESS is enough.
	 * Plus Jakarta Sans is opted out: it is declared by hand in fonts.css as a
	 * variable file covering 200-800 plus a true italic. Left to the module it
	 * would fetch weight 400 only, and the 500/700 the design system uses would
	 * be synthesised — while also duplicating what fonts.css already loads.
	 * ----------------------------- */
	/* -----------------------------
	 * Icons
	 * There is no icon module. Every glyph in this project is drawn by
	 * `NuxtDashboardIcon` — a `Record<string, string[]>` of path data rendered
	 * through one `v-for` — so there is no collection to bundle, no scanner to
	 * configure and no runtime that can fall through to a third-party fetch.
	 *
	 * @nuxt/icon and @iconify-json/material-symbols-light were both dropped
	 * when the last six call sites moved onto that set. Adding a glyph means
	 * adding an entry to `icon.vue`, not a dependency.
	 * ----------------------------- */

	fonts: {
		families: [
			{ name: "Plus Jakarta Sans", provider: "none" },
		],
	},

	/* -----------------------------
	 * Site metadata
	 * ----------------------------- */
	site: {
		url: process.env.NUXT_PUBLIC_SITE_URL || "https://localhost:3000/",
		name: "Champions Academy",
		description: "A trading community built on real education, live mentorship, and proven SMC strategy — as one connected system.",
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

		// Supabase is server-only. Nothing in the browser talks to it — the
		// affiliate dashboard reads through /api/* and gets realtime over SSE —
		// so no Supabase value belongs in `public`. Anything placed there is
		// serialised into window.__NUXT__ in the SSR'd HTML of every page.
		supabaseUrl: process.env.SUPABASE_URL || "",
		// Publishable key (sb_publishable_…): RLS applies. Used server-side only,
		// by the throwaway client that verifies passwords.
		supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || "",
		// Secret key (sb_secret_…): bypasses RLS. Never leaves the server.
		supabaseSecretKey: process.env.SUPABASE_SECRET_KEY || "",

		// Sent by Vercel Cron as `Authorization: Bearer <this>` on the daily
		// purge run. Server-side only, and the only caller is the scheduler.
		cronSecret: process.env.CRON_SECRET || "",

		// Peppers for one-way hashes. Kept in env, not the DB, so a database
		// leak on its own doesn't make the hashes reversible.
		otpPepper: process.env.OTP_PEPPER || "",
		visitPepper: process.env.VISIT_PEPPER || "",

		// Outbound mail (MailerSend). Server-side only: the token can send as
		// our verified domain, so it never belongs anywhere the browser can
		// read it. From-address and name are config rather than constants so a
		// staging deploy can send from somewhere else without a code change.
		mailersendApiKey: process.env.MAILERSEND_API_KEY || "",
		mailFromEmail: process.env.MAIL_FROM_EMAIL || "no-reply@mail.jointhevips.com",
		mailFromName: process.env.MAIL_FROM_NAME || "Champions Academy",

		// No PostHog *query* credentials here on purpose. Collection still runs
		// in the browser with the write-only project key below; nothing reads
		// back. The personal API key that used to sit here could read every
		// visitor event in the project, and the only route using it had already
		// been replaced by first-party counting. See the note in the deletion
		// commit for how to restore it if the Query API is ever wanted again.

		public: {
			// Write-only project key — safe in the browser, which is the whole
			// point of it being a separate key from the personal one above.
			posthogKey: process.env.POSTHOG_PROJECT_API_KEY || "",
			posthogHost: process.env.POSTHOG_HOST || "",
			storyblokApiKey: process.env.STORYBLOK_DELIVERY_API_TOKEN || "",
			bunnyStreamHostname: process.env.BUNNY_STREAM_HOSTNAME || "",
		},
	},

  /* -----------------------------
	 * Vite (LESS)
	 * ----------------------------- */
	vite: {
		// Pre-bundle deps that are only discovered at runtime (lazy imports),
		// so the dev server doesn't pause and reload the page mid-session
		optimizeDeps: {
			include: ["@storyblok/vue", "hls.js"],
		},
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
			// Champions Lifestyle is the organisation; Champions Academy is this
			// site's product. Structured data describes the organisation.
			name: "Champions Lifestyle",
			// Google's Organization guidance lists JPG/PNG/WebP and not SVG, so
			// this may simply be ignored for the search logo. Harmless either way,
			// and it beats the previous /images/logo.png which no longer exists.
			// Swap in a PNG if a logo ever needs to appear in a knowledge panel.
			logo: "/images/logo.svg",
			description: "A trading community built on real education, live mentorship, and proven SMC strategy — as one connected system.",
			email: "thechampionslifestyle@gmail.com",
			// No telephone or postal address, by choice.
			// Telegram is deliberately excluded: it points at a personal account
			// rather than a brand profile, which is not what sameAs is for.
			sameAs: [
				"https://youtube.com/@championslifestyleofficial",
				"https://www.instagram.com/thechampionslifestyle/",
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
			// The public changelog. It keeps the '/**' cache headers — it is the
			// same for every visitor and there is nothing personal on it — and
			// only adds the noindex. Public and unlisted are different things:
			// anyone with the link can read it, search engines are asked not to
			// list it. Deliberately *not* added to robots.txt as well, because a
			// Disallow would stop a crawler fetching the page at all and it
			// would therefore never see the noindex it is being told.
			'/changelog': {
			headers: {
				'x-robots-tag': 'noindex, nofollow'
			}
			},
			// Authenticated surfaces. Without these they inherit the '/**' rule
			// above and a CDN would cache one affiliate's dashboard and serve it
			// to the next visitor. More specific paths win and merge over '/**',
			// so the security headers there still apply.
			'/api/**': {
			headers: {
				'cache-control': 'private, no-store, max-age=0, must-revalidate',
				'x-robots-tag': 'noindex, nofollow'
			}
			},
			'/login': {
			headers: {
				'cache-control': 'private, no-store, max-age=0, must-revalidate',
				'x-robots-tag': 'noindex, nofollow'
			}
			},
			// Both spellings on purpose: whether '/dashboard/**' also matches the
			// bare '/dashboard' is a radix3 detail, and this is a security
			// control — not somewhere to rely on wildcard semantics.
			'/dashboard': {
			headers: {
				'cache-control': 'private, no-store, max-age=0, must-revalidate',
				'x-robots-tag': 'noindex, nofollow'
			}
			},
			'/dashboard/**': {
			headers: {
				'cache-control': 'private, no-store, max-age=0, must-revalidate',
				'x-robots-tag': 'noindex, nofollow'
			}
			},
		}
	},

	/* -----------------------------
	* Robots
	* ----------------------------- */
	robots: {
		groups: [
			{
				userAgent: ['*'],
				disallow: process.env.NUXT_PUBLIC_SITE_URL === 'https://localhost:3000/'
					? ['/api/', '/login', '/dashboard']
					: ['/', '/login', '/dashboard'],
			},
		],
	},

	/* -----------------------------
	 * Sitemap
	 * ----------------------------- */
	sitemap: {
		autoI18n: false,
		// Auto-discovered static routes are otherwise included, and /changelog
		// is served noindex — listing it in the sitemap would be asking to have
		// it crawled and telling it not to be indexed in the same breath.
		exclude: ['/changelog'],
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