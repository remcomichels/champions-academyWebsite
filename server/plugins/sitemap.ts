import StoryblokClient from 'storyblok-js-client'
import { isPageStory } from '#shared/utils/storyblok'

// Backstop for anything that *is* a page but still should not be listed.
// Which stories are pages at all is isPageStory's call, shared with the
// router so a story kept out of the sitemap is the same one that 404s.
const EXCLUDED_SLUGS = ['config']

export default defineNitroPlugin((nitroApp) => {
	// @ts-expect-error – nuxt-sitemap hook types not exposed
	nitroApp.hooks.hook('sitemap:resolved', async (ctx) => {
		const config = useRuntimeConfig()

		const client = new StoryblokClient({
			accessToken: config.public.storyblokApiKey,
			region: 'eu',
		})

		const stories = await client.getAll('cdn/stories', {
			version: 'published',
		})

		stories
			.filter((story) => isPageStory(story.content?.component))
			.filter((story) => !EXCLUDED_SLUGS.includes(story.full_slug))
			.forEach((story) => {
				ctx.urls.push({
					loc: story.full_slug === 'home' ? '/' : `/${story.full_slug}`,
					lastmod: story.published_at ?? story.created_at,
				})
			})
	})
})
