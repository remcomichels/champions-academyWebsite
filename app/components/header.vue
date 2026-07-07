<!-- eslint-disable vue/multi-word-component-names -->
<template>
	<header>
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
			<div class="navCol center">
				<nav v-if="headerMenu" class="mainNav">
					<nav class="menuContent">
						<ul>
							<li v-for="blok in headerMenu" :key="blok._uid" class="navItem">
								<NuxtLink
									v-if="blok.link?.cached_url"
									:to="localePath(normalizeSbPath(blok.link.cached_url))"
									class="navLink"
								>
									{{ blok.label ?? blok.link.cached_url }}
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
							v-if="blok.link?.cached_url"
							:to="localePath(normalizeSbPath(blok.link.cached_url))"
							class="navLink"
						>
							<span class="textWrap">
								<span class="text original">{{ blok.label }}</span>
								<!-- <span class="text duplicate">{{ blok.label }}</span> -->
							</span>
						</NuxtLink>
					</div>
				</nav>
			</div>
		</div>
	</header>
</template>

<script setup lang="ts">
import { useHeader } from "~/assets/js/components/header";

const { headerMenu, ctaMenu, localePath } = useHeader();

const normalizeSbPath = (cachedUrl: string) => {
  const clean = cachedUrl.replace(/^\/+|\/+$/g, "")
  return `/${clean}`
}
</script>
