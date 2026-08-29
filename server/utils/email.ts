import type { H3Event } from "h3";

/**
 * Outbound email, via MailerSend.
 *
 * Zero new dependencies: MailerSend's send endpoint is one JSON POST, and the
 * official SDK is a wrapper around exactly that. Adding it would buy nothing
 * and pull a dependency into the one code path that handles account recovery.
 *
 * Most values reaching a template are URLs we minted ourselves. The welcome
 * mail is the exception — it interpolates an affiliate's display name — so
 * everything user-supplied goes through `escape()` below. validate.ts already
 * rejects `<` and `>` in a display name, but a template that depends on a
 * validator three files away is one refactor from being an injection point.
 */

const MAILERSEND_ENDPOINT = "https://api.mailersend.com/v1/email";

/** Brand colours, lifted from dashboardTokens.less. Emails cannot read a var(). */
const INK = "#0A0A0C";
const INK_SOFT = "#5A5A5F";
const PAGE = "#F7F7F8";
const CARD = "#FFFFFF";
const RULE = "#E6E6E9";
const BRAND = "#A8FF57";

/** Where "this wasn't me" goes. A real human, deliberately not a no-reply. */
const SUPPORT_URL = "https://t.me/Remcoooo";

interface Mail {
	to: string;
	subject: string;
	html: string;
	text: string;
}

/**
 * Escapes a value for interpolation into an HTML template.
 *
 * Quotes included: a display name is currently only ever placed in element
 * content, but the day one lands in an attribute is not the day to discover
 * this only handled angle brackets.
 */
function escape(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

/**
 * Posts one message to MailerSend.
 *
 * Throws on failure so the caller can audit it. Callers must *not* turn that
 * throw into a different HTTP response than a success would produce — see the
 * note in forgot-password.post.ts about why a failed send still has to look
 * exactly like a successful one.
 */
async function send(mail: Mail): Promise<void> {
	const config = useRuntimeConfig();
	const apiKey = config.mailersendApiKey as string;
	const fromEmail = config.mailFromEmail as string;
	const fromName = config.mailFromName as string;

	if (!apiKey) {
		// In development there is usually no key and no verified domain. Print
		// the message instead of failing, so the whole flow can be exercised
		// locally — the reset link is in the text body.
		if (import.meta.dev) {
			console.warn(
				`[email] MAILERSEND_API_KEY unset — not sending.\n`
				+ `        to: ${mail.to}\n`
				+ `        subject: ${mail.subject}\n`
				+ `${mail.text}`,
			);
			return;
		}

		// Never silent in production: no key means password resets are dead.
		throw new Error("MAILERSEND_API_KEY is not configured");
	}

	const response = await fetch(MAILERSEND_ENDPOINT, {
		method: "POST",
		headers: {
			"Authorization": `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			from: { email: fromEmail, name: fromName },
			to: [{ email: mail.to }],
			subject: mail.subject,
			html: mail.html,
			text: mail.text,
		}),
	});

	// 202 Accepted is the success case; MailerSend queues rather than sends
	// inline. Anything else is a real failure worth surfacing.
	if (!response.ok) {
		const detail = await response.text().catch(() => "");

		// A provider that refuses us must not also stop the flow being worked
		// on. In development the message is printed so the reset link is still
		// reachable — the send is still treated as failed, and still audited,
		// so this cannot quietly mask an outage in production.
		if (import.meta.dev) {
			console.warn(
				`[email] provider refused this message — printing it so you can carry on.\n`
				+ `        to: ${mail.to}\n`
				+ `        subject: ${mail.subject}\n`
				+ `${mail.text}`,
			);
		}

		throw new Error(`MailerSend ${response.status}: ${detail.slice(0, 300)}`);
	}
}

/**
 * The shared shell.
 *
 * Tables and inline styles, because Outlook still renders with Word's engine
 * and understands neither flexbox nor a <style> block. The logo is a PNG for
 * the same class of reason: no major client renders SVG, so the site's own
 * mark cannot be used directly — see public/images/logo-email.png.
 */
function layout(origin: string, heading: string, body: string): string {
	return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${PAGE};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${CARD};border:1px solid ${RULE};border-radius:12px;">
        <tr><td style="padding:32px 32px 0 32px;">
          <img src="${origin}/images/logo-email.png" width="140" alt="Champions Academy" style="display:block;border:0;width:140px;height:auto;">
        </td></tr>
        <tr><td style="padding:24px 32px 0 32px;">
          <h1 style="margin:0;font:600 22px/1.3 -apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:${INK};">${heading}</h1>
        </td></tr>
        <tr><td style="padding:16px 32px 32px 32px;font:400 15px/1.6 -apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:${INK_SOFT};">
          ${body}
        </td></tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        <tr><td style="padding:20px 32px;font:400 12px/1.5 -apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:${INK_SOFT};" align="center">
          Champions Academy · this address is not monitored
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** A button that survives Outlook — a table cell with a link, not a styled <a>. */
function button(href: string, label: string): string {
	return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr><td style="background:${BRAND};border-radius:8px;">
      <a href="${href}" style="display:inline-block;padding:13px 24px;font:600 15px/1 -apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:${INK};text-decoration:none;">${label}</a>
    </td></tr>
  </table>`;
}

/**
 * "Someone asked to reset your password."
 *
 * Tells an unintended recipient to ignore it and says why that is safe. It
 * deliberately does not ask them to contact anyone: a reset *request* changes
 * nothing on its own, and training people to reply to security mail is the
 * reflex phishing depends on. The email that does ask for contact is the one
 * below, sent only once something has actually changed.
 */
export async function sendPasswordResetEmail(event: H3Event, to: string, token: string): Promise<void> {
	const origin = siteOrigin(event);
	const link = `${origin}/reset-password?token=${encodeURIComponent(token)}`;

	await send({
		to,
		subject: "Reset your Champions Academy password",
		html: layout(origin, "Reset your password", `
      <p style="margin:0;">Someone asked to reset the password for this account. Choose a new one here:</p>
      ${button(link, "Choose a new password")}
      <p style="margin:0;">This link works once and expires in <strong style="color:${INK};">one hour</strong>.</p>
      <p style="margin:16px 0 0 0;"><strong style="color:${INK};">Didn't request this?</strong> You can safely ignore this email. Your password has not changed and nobody can get in without this link.</p>
      <p style="margin:24px 0 0 0;font-size:13px;color:${INK_SOFT};">If the button doesn't work, paste this into your browser:<br><span style="word-break:break-all;">${link}</span></p>
    `),
		text: [
			"Reset your password",
			"",
			"Someone asked to reset the password for this account. Choose a new one here:",
			link,
			"",
			"This link works once and expires in one hour.",
			"",
			"Didn't request this? You can safely ignore this email. Your password has not",
			"changed and nobody can get in without this link.",
			"",
			"— Champions Academy",
		].join("\n"),
	});
}

/**
 * "Your password was changed."
 *
 * The one that matters. By the time this lands something real has happened, so
 * unlike the request mail it does give the recipient somewhere to go — and it
 * goes to a person, not a form.
 */
export async function sendPasswordChangedEmail(event: H3Event, to: string): Promise<void> {
	const origin = siteOrigin(event);
	const when = new Date().toUTCString();

	await send({
		to,
		subject: "Your Champions Academy password was changed",
		html: layout(origin, "Your password was changed", `
      <p style="margin:0;">The password for this account was changed on <strong style="color:${INK};">${when}</strong>. Every other device has been signed out.</p>
      <p style="margin:16px 0 0 0;"><strong style="color:${INK};">Wasn't you?</strong> Get in touch straight away — whoever did this has access right now.</p>
      ${button(SUPPORT_URL, "Message us on Telegram")}
      <p style="margin:0;font-size:13px;">${SUPPORT_URL}</p>
    `),
		text: [
			"Your password was changed",
			"",
			`The password for this account was changed on ${when}.`,
			"Every other device has been signed out.",
			"",
			"Wasn't you? Get in touch straight away — whoever did this has access right now.",
			SUPPORT_URL,
			"",
			"— Champions Academy",
		].join("\n"),
	});
}

/**
 * "Your account is ready."
 *
 * Sent once, when an invite code is redeemed. It leads with the referral link
 * rather than with a welcome: that link is the entire job, and an affiliate
 * who reads no further than the first screen still has the one thing they
 * came for. The dashboard is the second call to action, not the first.
 */
export async function sendWelcomeEmail(
	event: H3Event,
	to: string,
	displayName: string,
	slug: string,
): Promise<void> {
	const origin = siteOrigin(event);
	const link = referralUrl(event, slug);
	const name = escape(displayName);

	await send({
		to,
		subject: "Your Champions Academy affiliate account is ready",
		html: layout(origin, `Welcome, ${name}`, `
      <p style="margin:0;">Your account is set up. This is your referral link — everyone who arrives through it is tracked to you:</p>
      <p style="margin:20px 0;padding:14px 16px;background:${PAGE};border:1px solid ${RULE};border-radius:8px;font:600 15px/1.5 -apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:${INK};word-break:break-all;">${link}</p>
      <p style="margin:0;">Put it in a bio, a video description, a story — anywhere your audience already is. Visits and sales show up on your dashboard.</p>
      ${button(`${origin}/dashboard`, "Open your dashboard")}
      <p style="margin:0;">Questions, or something looks wrong? <a href="${SUPPORT_URL}" style="color:${INK};">Message us on Telegram</a>.</p>
    `),
		text: [
			`Welcome, ${displayName}`,
			"",
			"Your account is set up. This is your referral link — everyone who",
			"arrives through it is tracked to you:",
			"",
			link,
			"",
			"Put it in a bio, a video description, a story — anywhere your audience",
			"already is. Visits and sales show up on your dashboard.",
			"",
			`Your dashboard: ${origin}/dashboard`,
			"",
			`Questions, or something looks wrong? ${SUPPORT_URL}`,
			"",
			"— Champions Academy",
		].join("\n"),
	});
}
