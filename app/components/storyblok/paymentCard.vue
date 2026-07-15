<template>
	<article v-editable="blok" class="payment-card">
		<h3 class="payment-card-title">{{ blok.title }}</h3>

		<div class="payment-card-price">
			<span class="price">{{ blok.price }}</span>
			<span class="price-adjective">{{ blok.price_adjative }}</span>
		</div>

		<ul v-if="blok.benefit?.length" class="payment-card-benefits">
			<li v-for="textBlok in blok.benefit" :key="textBlok._uid" class="payment-card-benefit">
				<StoryblokComponent :blok="textBlok" />
			</li>
		</ul>

		<div v-if="blok.Bonus_benefit" class="payment-card-bonus-container">
			<span class="icon-candles"/>
			<p class="payment-card-bonus">{{ blok.Bonus_benefit }}</p>
		</div>

		<div class="payment-card-footer">
			<p class="payment-card-subText">{{ blok.subText_button }}</p>
			<StoryblokComponent
				v-for="buttonBlok in blok.button"
				:key="buttonBlok._uid"
				:blok="buttonBlok"
			/>
		</div>
	</article>
</template>

<script setup lang="ts">
defineProps({
	blok: {
		type: Object,
		required: true,
	},
});
</script>
