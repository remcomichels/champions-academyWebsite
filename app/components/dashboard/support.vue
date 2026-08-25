<template>
	<div class="dashSection">
		<section class="dashPanel">
			<h2 class="dashPanel-title">Need a hand?</h2>
			<p class="dashPanel-note">
				Message us directly — that's the fastest route, and there's no ticket queue.
			</p>
			<a class="btn btn--primary supportCta" :href="telegramUrl" target="_blank" rel="noopener noreferrer">
				Message us on Telegram
			</a>
		</section>

		<section class="dashPanel">
			<div class="dashPanel-head">
				<h2 class="dashPanel-title">Common questions</h2>
				<input v-model="query" class="field-input supportSearch" type="search" placeholder="Search…">
			</div>

			<ul v-if="matches.length" class="faq">
				<li v-for="item in matches" :key="item.q" class="faq-item">
					<button
						type="button"
						class="faq-question"
						:aria-expanded="openQuestion === item.q"
						@click="toggle(item.q)"
					>
						{{ item.q }}
					</button>
					<div class="faq-answer" :class="{ 'is-open': openQuestion === item.q }">
						<p>{{ item.a }}</p>
					</div>
				</li>
			</ul>

			<p v-else class="dashPanel-empty">
				Nothing matches “{{ query }}”. Message us on Telegram and we'll sort it.
			</p>
		</section>
	</div>
</template>

<script setup lang="ts">
/**
 * Support. A direct line first, with the FAQ underneath for the handful of
 * questions that come up every time — most of which are about the two numbers
 * not matching, which is expected and worth explaining once here rather than
 * repeatedly over chat.
 */
const telegramUrl = "https://t.me/TheMeganSavage";

const faq = [
	{
		q: "How do I get paid?",
		a: "Whop pays you directly. It works out the commission, holds it for 30 days after the sale, then pays out automatically — we never handle the money. The Sales tab links straight through to your Whop dashboard for anything financial.",
	},
	{
		q: "Why does Sales show fewer sales than I expected?",
		a: "A sale is only credited when it completes. Checkouts that are started and abandoned, or where the card is declined, don't count. If someone tells you they bought and it isn't showing after an hour, message us with the date and we'll look it up.",
	},
	{
		q: "Why is Link clicks lower than Link visits?",
		a: "They are two different steps. A visit is someone opening your link. A click is them going on to tap one of your plans from the page they landed on. Not everyone who arrives taps through, so clicks is always the smaller number — the gap between the two is the people who looked and left.",
	},
	{
		q: "How long does my link keep working after someone clicks it?",
		a: "30 days. If they open your link and buy any time in the next 30 days, it's credited to you — they don't have to buy in that first visit.",
	},
	{
		q: "I changed my Telegram or Calendly link, why does the site still show the old one?",
		a: "Links are cached for about five minutes. Wait a few minutes and reload the page you're checking.",
	},
	{
		q: "What happens if I leave my Telegram or Calendly blank?",
		a: "That button keeps the standard site link. Nothing breaks — you just don't get the traffic from it.",
	},
	{
		q: "It says my VIP link is being set up. What do I do?",
		a: "Nothing — that one's on us. Until it's ready the VIP buttons use the standard link, which means those sales aren't credited to you, so tell us if it stays that way for more than a day.",
	},
	{
		q: "I've lost my password.",
		a: "Message us and we'll issue you a new one-time invite code. That's the reset — we can't send a reset email.",
	},
];

const query = ref("");
const openQuestion = ref<string | null>(null);

const matches = computed(() => {
	const term = query.value.trim().toLowerCase();
	if (!term) return faq;
	return faq.filter(item =>
		item.q.toLowerCase().includes(term) || item.a.toLowerCase().includes(term));
});

const toggle = (question: string) => {
	openQuestion.value = openQuestion.value === question ? null : question;
};
</script>
