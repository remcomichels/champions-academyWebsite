<template>
	<header :class="{ scrolled }">
		<div class="headerWrapper">
			<div class="navCol left">
				<NuxtLink :to="localePath(`/`)" class="logoLink">
					<NuxtAppImage
						class="logoImage"
						:src="`/images/logo.svg`"
						:alt="`Champions Academy Logo`"

					/>
				</NuxtLink>
			</div>
			<div class="menuWrap" :class="{ open: menuOpen }">
				<div class="navCol center">
					<nav v-if="headerMenu" class="mainNav">
						<nav class="menuContent">
							<ul>
								<li v-for="blok in headerMenu" :key="blok._uid" class="navItem">
									<NuxtLink
										v-if="linkTo(blok.link)"
										:to="linkTo(blok.link)!"
										v-bind="storyblokLinkAttrs(blok.link)"
										class="navLink parent-line"
									>
										{{ blok.label ?? blok.link?.cached_url }}
										<span class="link-line" />
									</NuxtLink>
								</li>
							</ul>
						</nav>
					</nav>
				</div>
				<div class="navCol right">
					<nav v-if="ctaMenu" class="ctaNav">
						<div v-for="blok in ctaMenu" :key="blok._uid" class="navItem">
							<NuxtLink
								v-if="linkTo(blok.link)"
								:to="linkTo(blok.link)!"
								v-bind="storyblokLinkAttrs(blok.link)"
								class="navLink button"
							>
								<span class="textWrap button__primary">
									{{ blok.label }}
								</span>
								<span class="plus icon-plus" />
							</NuxtLink>
						</div>
					</nav>
				</div>
			</div>
			<button
				class="hamburger"
				:class="{ open: menuOpen }"
				type="button"
				aria-label="Toggle menu"
				:aria-expanded="menuOpen"
				@click="toggleMenu"
			>
				<span />
				<span />
			</button>
		</div>
	</header>
</template>

<script setup lang="ts">
import { useHeader } from "~/assets/js/components/header";

const { headerMenu, ctaMenu, localePath, menuOpen, toggleMenu, scrolled } = useHeader();

// Resolves a Storyblok multilink to a localized href, keeping any section
// anchor set in the CMS (e.g. /about#pricing).
const linkTo = useStoryblokLink();
</script>
