<template>
	<section class="section policyPage">
		<div class="container">
			<div class="policyPage-inner">
				<header class="policyPage-head">
					<h1 class="policyPage-title">Privacy Policy</h1>
					<p class="policyPage-text">
						How Champions Academy collects, uses, shares and protects your personal
						information when you visit this website or use our services.
					</p>
					<p class="policyPage-date">
						Effective date: <time :datetime="EFFECTIVE_DATE_ISO">{{ effectiveDate }}</time>
					</p>
				</header>

				<!-- Fourteen sections is past the point where scrolling to find one is
				     reasonable, and the sections people arrive looking for — their
				     rights, cookies, who we share data with — are the back half. -->
				<nav class="policy-toc" aria-labelledby="policy-toc-title">
					<p id="policy-toc-title" class="policy-toc-title">Contents</p>
					<ol class="policy-toc-list">
						<li v-for="section in sections" :key="section.id" class="policy-toc-item">
							<a :href="`#${section.id}`" class="policy-tocLink">{{ section.label }}</a>
						</li>
					</ol>
				</nav>

				<!-- ── 1 ─────────────────────────────────────────────────────────── -->
				<section id="who-we-are" class="policy-section">
					<h2 class="policy-heading">1. Who we are</h2>
					<p class="policy-copy">
						Champions Academy is a product of <strong>Champions Lifestyle</strong> ("we",
						"us", "our"), which operates educational trading communities providing
						mentorship, educational content, trade ideas and community resources.
					</p>
					<p class="policy-copy">
						We are not licensed financial advisors. Nothing on our platform constitutes
						financial advice.
					</p>
					<p class="policy-copy">
						<strong>Data controller:</strong> Champions Lifestyle, operating as Champions
						Trading MC Inc. Our administrators are located in the
						<strong>Netherlands and Canada</strong>, and all of them may access personal
						data held in our systems in order to run the service. No one outside that
						group has access.
					</p>
					<p class="policy-copy">
						<strong>Privacy contact:</strong>{{ " " }}
						<a :href="`mailto:${CONTACT_EMAIL}`" class="policy-link">{{ CONTACT_EMAIL }}</a>
					</p>
				</section>

				<!-- ── 2 ─────────────────────────────────────────────────────────── -->
				<section id="what-we-collect" class="policy-section">
					<h2 class="policy-heading">2. Information we collect</h2>

					<h3 class="policy-subheading">If you visit the website</h3>
					<ul class="policy-list">
						<li class="policy-item">
							Analytics data — pages visited, approximate location derived from your IP
							address, device and browser type, and how long you stay. Only collected if
							analytics is enabled for you (see
							<a href="#cookies" class="policy-link">Section 5</a>).
						</li>
						<li class="policy-item">
							If you arrive through an affiliate's referral link, we record that visit
							against that affiliate. This is stored as a one-way hash of your IP address
							and browser, which changes daily. <strong>We do not store your IP address
							or browser string for this purpose</strong>, and the hash cannot be
							reversed to identify you.
						</li>
						<li class="policy-item">
							If you arrive without a referral link and then open one of our Telegram or
							booking links, we assign you to one of the owners of Champions Academy,
							shared evenly between them. That decides which of their Telegram groups
							the link opens, and is remembered for 30 days so you keep reaching the
							same place. It is recorded the same way as above, with the same daily
							one-way hash — <strong>no IP address or browser string is stored</strong>.
							<strong>Nothing is assigned until you open one of those links</strong>;
							simply reading the site assigns you to nobody.
						</li>
					</ul>

					<h3 class="policy-subheading">If you are an affiliate</h3>
					<ul class="policy-list">
						<li class="policy-item">
							Your name, email address and password (stored only as a cryptographic hash
							— we never see or store your actual password).
						</li>
						<li class="policy-item">
							Your session records, including approximate device type, IP address and the
							times you signed in.
						</li>
						<li class="policy-item">
							The Telegram link you provide.
						</li>
						<li class="policy-item">
							A log of security-relevant actions on your account, such as sign-ins,
							password changes and link changes.
						</li>
					</ul>

					<h3 class="policy-subheading">If you join our community</h3>
					<ul class="policy-list">
						<li class="policy-item">
							Access is arranged through Telegram. <strong>We do not process payments on
							this website and never see or store your payment card details.</strong>
						</li>
						<li class="policy-item">
							We do not receive or store any record of individual members from Telegram —
							no usernames, email addresses or real names.
						</li>
					</ul>

					<h3 class="policy-subheading">If you contact us</h3>
					<ul class="policy-list">
						<li class="policy-item">
							Whatever you send us by email or messaging, and our replies.
						</li>
					</ul>
				</section>

				<!-- ── 3 ─────────────────────────────────────────────────────────── -->
				<section id="how-we-use-it" class="policy-section">
					<h2 class="policy-heading">3. How we use this information</h2>
					<ul class="policy-list">
						<li class="policy-item">To provide access to our community and services.</li>
						<li class="policy-item">
							To operate the affiliate programme, including crediting affiliates for the
							people they refer.
						</li>
						<li class="policy-item">
							To keep accounts secure — detecting unusual sign-in activity and
							rate-limiting abuse.
						</li>
						<li class="policy-item">To understand how the website is used and improve it.</li>
						<li class="policy-item">To respond to your questions.</li>
						<li class="policy-item">
							To meet legal obligations and protect our legal rights.
						</li>
					</ul>
					<p class="policy-copy">
						We rely on <strong>contract</strong> as our legal basis for running accounts
						and the affiliate programme, <strong>legitimate interests</strong> for security
						and fraud prevention, and <strong>consent</strong> for analytics where consent
						is required.
					</p>
				</section>

				<!-- ── 4 ─────────────────────────────────────────────────────────── -->
				<section id="who-sees-what" class="policy-section">
					<h2 class="policy-heading">4. Who can see what</h2>
					<p class="policy-copy">
						<strong>Affiliates can see aggregate visit and click counts for their own
						link</strong>, and nothing that identifies an individual visitor. They cannot
						see anything at all about anyone who did not use their link.
					</p>
					<p class="policy-copy">
						Our administrators can see affiliate account details and aggregate figures. No
						one else has access to our systems.
					</p>
					<p class="policy-copy"><strong>We do not sell personal information.</strong></p>
				</section>

				<!-- ── 5 ─────────────────────────────────────────────────────────── -->
				<section id="cookies" class="policy-section">
					<h2 class="policy-heading">5. Cookies and analytics</h2>
					<p class="policy-copy">
						We use PostHog for website analytics. It sets cookies and records page views,
						approximate country and device type.
					</p>
					<p class="policy-copy">
						<strong>If you are in the EEA, the UK or Switzerland</strong>, we ask before
						setting any analytics cookie. If you decline, nothing is loaded and no
						analytics cookie is set. Elsewhere, analytics runs by default.
					</p>
					<p class="policy-copy">
						<strong>You can change your choice at any time</strong>, here or from the
						"Cookie settings" link in the footer of every page. Withdrawing is as easy as
						giving consent, and takes effect immediately.
					</p>

					<!-- The control itself, not just a description of where to find it:
					     withdrawing has to be as easy as giving. It is the footer's own
					     component so the behaviour has a single definition, and it must
					     stay inside <ClientOnly> — useConsent() reads a cookie, and
					     rendering it on the server would put consent state in the SSR
					     payload and make this page vary by cookie. -->
					<ClientOnly>
						<p class="policy-consent">
							<NuxtCookieSettingsButton />
						</p>
					</ClientOnly>

					<p class="policy-copy">
						Cookies strictly necessary for the site to work — such as keeping you signed
						in, remembering which affiliate referred you, and remembering which owner's
						Telegram group your Join link opens — are always set, as they are required to
						provide the service you asked for. The last of those is not set while you are
						only reading the site: it is written at the moment you open one of those
						links, because that is when it is needed to send you anywhere.
					</p>
					<p class="policy-copy">
						We do <strong>not</strong> use advertising or retargeting pixels on this
						website.
					</p>
				</section>

				<!-- ── 6 ─────────────────────────────────────────────────────────── -->
				<section id="service-providers" class="policy-section">
					<h2 class="policy-heading">6. Service providers</h2>
					<div class="policy-tableWrap">
						<table class="policy-table">
							<thead>
								<tr>
									<th scope="col">Provider</th>
									<th scope="col">What they handle</th>
									<th scope="col">Where</th>
								</tr>
							</thead>
							<tbody>
								<tr v-for="provider in providers" :key="provider.name">
									<td><strong>{{ provider.name }}</strong></td>
									<td>{{ provider.handles }}</td>
									<td><strong>{{ provider.where }}</strong></td>
								</tr>
							</tbody>
						</table>
					</div>
					<p class="policy-copy">Each processes data only on our instructions.</p>
				</section>

				<!-- ── 7 ─────────────────────────────────────────────────────────── -->
				<section id="international-transfers" class="policy-section">
					<h2 class="policy-heading">7. International transfers</h2>
					<p class="policy-copy">
						Some of our providers store or process data outside the European Economic
						Area, principally in the <strong>United States</strong> (Supabase, PostHog,
						Vercel). Some of our administrators are located in <strong>Canada</strong>.
					</p>
					<p class="policy-copy">
						Where personal data leaves the EEA or the United Kingdom we rely on:
					</p>
					<ul class="policy-list">
						<li class="policy-item">
							the European Commission's <strong>adequacy decision for Canada</strong>
							(for commercial organisations under PIPEDA), and the equivalent
							<strong>UK adequacy regulations</strong> for transfers from the United
							Kingdom;
						</li>
						<li class="policy-item">
							<strong>Standard Contractual Clauses</strong> (EU Module Two,
							controller-to-processor), with the <strong>UK Addendum</strong> where the
							transfer is from the United Kingdom, for transfers to
							<strong>Supabase</strong> in the United States; and
						</li>
						<li class="policy-item">
							the <strong>EU–US Data Privacy Framework</strong> and its
							<strong>UK Extension</strong> for transfers to <strong>PostHog</strong>
							and <strong>Vercel</strong> in the United States, with Standard
							Contractual Clauses applying as a fallback mechanism should either
							certification lapse or be invalidated.
						</li>
					</ul>
					<p class="policy-copy">
						You can request details of the safeguards in place by contacting us.
					</p>
				</section>

				<!-- ── 8 ─────────────────────────────────────────────────────────── -->
				<section id="retention" class="policy-section">
					<h2 class="policy-heading">8. How long we keep it</h2>
					<ul class="policy-list">
						<li class="policy-item">
							<strong>Affiliate accounts</strong> — for as long as the account is open.
							Deleting your account is subject to a 14-day grace period, after which the
							data is removed.
						</li>
						<li class="policy-item">
							<strong>Sessions</strong> — a maximum of 30 days, and sooner if unused for
							7 days.
						</li>
						<li class="policy-item">
							<strong>Referral visit records</strong> — the daily hash is not reversible
							and is not linked to you. Aggregate counts are kept for as long as the
							affiliate account exists.
						</li>
						<li class="policy-item">
							<strong>Analytics</strong> — retained by PostHog for up to one year.
						</li>
						<li class="policy-item">
							<strong>Account activity logs</strong> — retained for security and dispute
							resolution.
						</li>
					</ul>
				</section>

				<!-- ── 9 ─────────────────────────────────────────────────────────── -->
				<section id="your-rights" class="policy-section">
					<h2 class="policy-heading">9. Your rights</h2>
					<p class="policy-copy">
						Depending on where you live, you may have the right to access your data,
						correct it, delete it, restrict or object to processing, receive a portable
						copy, withdraw consent, and complain to a data protection authority.
					</p>
					<p class="policy-copy">
						<strong>Affiliates can do this directly:</strong> the Settings tab of the
						dashboard has one-click <strong>Delete my account</strong>. For a copy of
						everything we hold about you, ask at the address below.
					</p>
					<p class="policy-copy">
						Everyone else can contact
						<a :href="`mailto:${CONTACT_EMAIL}`" class="policy-link">{{ CONTACT_EMAIL }}</a>
						and we will respond within one month.
					</p>
					<p class="policy-copy">
						If you are in the EEA you may complain to your local authority; in the
						Netherlands this is the <strong>Autoriteit Persoonsgegevens</strong>
						(<a
							href="https://autoriteitpersoonsgegevens.nl"
							target="_blank"
							rel="noopener"
							class="policy-link"
						>autoriteitpersoonsgegevens.nl</a>). In the UK it is the <strong>ICO</strong>
						(<a
							href="https://ico.org.uk"
							target="_blank"
							rel="noopener"
							class="policy-link"
						>ico.org.uk</a>).
					</p>
				</section>

				<!-- ── 10 ────────────────────────────────────────────────────────── -->
				<section id="california" class="policy-section">
					<h2 class="policy-heading">10. California residents</h2>
					<p class="policy-copy">
						If you are a California resident, you have the right to know what personal
						information we collect, to delete it, to correct it, and to opt out of its
						sale or sharing. <strong>We do not sell or share personal information</strong>
						as those terms are defined under the CCPA/CPRA. We will not discriminate
						against you for exercising these rights. Contact us at the address above.
					</p>
				</section>

				<!-- ── 11 ────────────────────────────────────────────────────────── -->
				<section id="children" class="policy-section">
					<h2 class="policy-heading">11. Children</h2>
					<p class="policy-copy">
						Our services are for people aged 18 and over. We do not knowingly collect
						personal information from anyone under 18. If we learn that we have, we will
						delete it promptly.
					</p>
				</section>

				<!-- ── 12 ────────────────────────────────────────────────────────── -->
				<section id="other-sites" class="policy-section">
					<h2 class="policy-heading">12. Links to other sites</h2>
					<p class="policy-copy">
						Our website links to third-party platforms including Telegram, YouTube and
						Instagram. We are not responsible for their privacy practices and encourage
						you to read their policies.
					</p>
				</section>

				<!-- ── 13 ────────────────────────────────────────────────────────── -->
				<section id="changes" class="policy-section">
					<h2 class="policy-heading">13. Changes to this policy</h2>
					<p class="policy-copy">
						We may update this policy from time to time. When we do, we will change the
						effective date above. Material changes will be brought to your attention.
					</p>
				</section>

				<!-- ── 14 ────────────────────────────────────────────────────────── -->
				<section id="contact" class="policy-section">
					<h2 class="policy-heading">14. Contact</h2>
					<p class="policy-copy">
						<strong>Champions Lifestyle</strong><br>
						Email:
						<a :href="`mailto:${CONTACT_EMAIL}`" class="policy-link">{{ CONTACT_EMAIL }}</a><br>
						Website:
						<a href="https://www.jointhevips.com" class="policy-link">www.jointhevips.com</a>
					</p>
				</section>
			</div>
		</div>
	</section>
</template>

<script setup lang="ts">
/**
 * The privacy policy.
 *
 * A page in code rather than a Storyblok story, for the same reason the
 * changelog is: it is a document, not a marketing surface. Two things follow
 * from that. Legal text should change through a reviewed commit, so the git
 * history is the record of what the policy said on any given date — which is
 * the thing you need if the version in force is ever disputed. And the content
 * is headings, nested lists and a table, which the block library has no shape
 * for; it would have meant a new rich-text block in the Storyblok space and
 * pasting a table into an editor that mangles them.
 *
 * The source of truth for the wording is docs/privacy-policy-draft.md. Edit
 * both together, or delete the draft once this page is the only copy.
 *
 * Indexed, unlike /changelog: a privacy policy that search engines cannot see
 * is one that people looking for it cannot find, and the consent banner on
 * every page links here.
 */

// The date the current wording took effect — shown to the reader and used for
// the <time> attribute. Section 13 promises this changes whenever the policy
// does, so it is one constant rather than a string repeated in two formats.
const EFFECTIVE_DATE_ISO = "2026-09-05";

// en-GB: "5 September 2026". The site's own convention elsewhere is en-GB, and
// a policy is one of the places where a date read as 09/05 by half the audience
// and 05/09 by the other half is an actual problem, so it is spelled out.
const effectiveDate = new Date(EFFECTIVE_DATE_ISO).toLocaleDateString("en-GB", {
	day: "numeric",
	month: "long",
	year: "numeric",
});

// The one address the policy gives out, in Sections 1, 9 and 14. The draft had
// this split between a legal address and a personal one; everything legal goes
// to the legal inbox, and a policy that offers two addresses for the same
// request invites half of them into the one nobody is watching.
//
// Section 9 is the one that has to stay true: it is the address a data subject
// is told to use to exercise a right. The draft's "one-click Download my data"
// was dropped from it because that export no longer exists —
// server/api/affiliate/gdpr.post.ts takes `delete` and `cancel` only. A policy
// promising a portability mechanism the product does not have is worse than one
// that says to ask, so it says to ask. If the export comes back, this paragraph
// changes with it.
const CONTACT_EMAIL = "legal@championstradingmc.com";

const sections = [
	{ id: "who-we-are", label: "1. Who we are" },
	{ id: "what-we-collect", label: "2. Information we collect" },
	{ id: "how-we-use-it", label: "3. How we use this information" },
	{ id: "who-sees-what", label: "4. Who can see what" },
	{ id: "cookies", label: "5. Cookies and analytics" },
	{ id: "service-providers", label: "6. Service providers" },
	{ id: "international-transfers", label: "7. International transfers" },
	{ id: "retention", label: "8. How long we keep it" },
	{ id: "your-rights", label: "9. Your rights" },
	{ id: "california", label: "10. California residents" },
	{ id: "children", label: "11. Children" },
	{ id: "other-sites", label: "12. Links to other sites" },
	{ id: "changes", label: "13. Changes to this policy" },
	{ id: "contact", label: "14. Contact" },
];

const providers = [
	{
		name: "Supabase",
		handles: "Affiliate accounts, passwords (hashed), sessions, referral records",
		where: "United States",
	},
	{ name: "PostHog", handles: "Website analytics", where: "United States" },
	{ name: "Storyblok", handles: "Website content", where: "European Union" },
	{ name: "Bunny.net", handles: "Video delivery", where: "Global CDN" },
	{ name: "Vercel", handles: "Website hosting", where: "Global CDN, United States" },
];

const { url: siteUrl } = useSiteConfig();
const ogImageUrl = `${siteUrl.replace(/\/+$/, "")}/images/og-image.png`;

const title = "Privacy Policy | Champions Academy";
const description
	= "How Champions Academy collects, uses, shares and protects your personal information.";

useSeoMeta({
	title,
	description,
	ogType: "website",
	ogTitle: title,
	ogDescription: description,
	ogImage: ogImageUrl,
	twitterCard: "summary_large_image",
	twitterTitle: title,
	twitterDescription: description,
	twitterImage: ogImageUrl,
});
</script>
