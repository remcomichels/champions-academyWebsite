// types/storyblok.ts

import type { LinkRoleField } from "#shared/types/affiliate"

export type StoryblokLinkType = "story" | "url" | "email" | "asset"

export interface StoryblokMultilink {
  id?: string
  url?: string
  linktype: StoryblokLinkType
  fieldtype?: "multilink"
  cached_url?: string
  /**
   * Section anchor set in the link field's "Anchor" input (stored without the
   * leading #). resolveStoryblokLink appends it, and blocks expose matching ids
   * via their own `anchor` field.
   */
  anchor?: string
  /**
   * "_blank" when the link field's open-in-new-tab toggle is on. Apply it with
   * storyblokLinkAttrs so the matching rel is set too.
   */
  target?: string
}

export interface StoryblokAsset {
  id?: number
  alt?: string
  name?: string
  title?: string
  filename?: string
  fieldtype?: "asset"
}

/**
 * Your Storyblok menu component ("menu_link") shape.
 * Works for both header_menu and cta_menu.
 */
export interface MenuLinkItem {
  _uid: string
  component?: "menu_link"
  label?: string
  link?: StoryblokMultilink
  /**
   * Marks this link as centrally managed. When set, the href comes from the
   * referring affiliate or the config-story default for that role, and the
   * `link` field above is ignored. See `useRoleHref`.
   */
  link_role?: LinkRoleField
}

export interface LogoItem {
  _uid: string
  component?: "logo"
  logo?: StoryblokAsset
}

export type HeaderMenuItem = MenuLinkItem
export type CtaMenuItem = MenuLinkItem

/**
 * The "footer_menu" block from the config story — brand, three link columns,
 * and the sub-footer disclaimer line.
 */
export interface FooterMenu {
  _uid: string
  component?: "footer_menu"
  footer_image?: StoryblokAsset
  footer_subTitle?: string
  footer_titleLeft?: string
  footer_titleMiddle?: string
  footer_titleRight?: string
  footer_linkLeft?: MenuLinkItem[]
  footer_linkMiddle?: MenuLinkItem[]
  footer_linkRight?: MenuLinkItem[]
  subFooter_text?: string
}

/**
 * The "statistic" block — nested in statistics_block's `statistic` blocks field.
 */
export interface StatisticBlok {
  _uid: string
  component?: "statistic"
  count?: string
  sub_title?: string
}

/**
 * The "card" block — nested in aboutUs_block's `cards` blocks field.
 * The card number (01, 02, …) is derived from its position, not a field.
 */
export interface AboutCardBlok {
  _uid: string
  component?: "card"
  title?: string
  text?: string
}

/**
 * The "aboutUs_block" — pinned section that flips through its cards on scroll.
 */
export interface AboutUsBlok {
  _uid: string
  component?: "aboutUs_block"
  sub_title?: string
  title?: string
  text?: string
  cards?: AboutCardBlok[]
}

/**
 * A story reference resolved via resolve_relations (e.g. the benefits_block's
 * `benefit` multi-options field). `name` is the story title in Storyblok.
 */
export interface BenefitStoryRef {
  uuid?: string
  name?: string
  full_slug?: string
  content?: Record<string, unknown>
}

/**
 * The "benefits_block" — intro text plus a 3×2 grid of referenced benefit stories.
 */
export interface BenefitsBlok {
  _uid: string
  component?: "benefits_block"
  sub_text?: string
  title?: string
  sub_title?: string
  text?: string
  button?: ButtonBlok[]
  benefit?: (string | BenefitStoryRef)[]
}

/**
 * The "benefitsOverview_block" — the /benefits page. Every story in the
 * Storyblok `benefits/` folder is fetched at render time (no reference field),
 * so the grid and its counter stay in sync as benefits are added.
 */
export interface BenefitsOverviewBlok {
  _uid: string
  component?: "benefitsOverview_block"
  sub_text?: string
  title?: string
}

/**
 * The "text" block — a single plain-text line, nestable anywhere
 * (e.g. paymentCard's `benefit` list).
 */
export interface TextBlok {
  _uid: string
  component?: "text"
  text?: string
}

/**
 * The "paymentCard" block — nested in paymentPlans_block's `paymentCard` field.
 */
export interface PaymentCardBlok {
  _uid: string
  component?: "paymentCard"
  title?: string
  price?: string
  price_adjative?: string
  benefit?: TextBlok[]
  Bonus_benefit?: string
  // Replaces the former plain-text `subText_button`. That field was deleted
  // rather than converted: Storyblok validates stored content against the
  // schema, and the old string value could never satisfy a rich-text field.
  subText_button_rich?: unknown // Storyblok rich-text document
  button?: ButtonBlok[]
}

/**
 * The "paymentPlans_block" — sub_title/title plus two 50% payment cards.
 */
export interface PaymentPlansBlok {
  _uid: string
  component?: "paymentPlans_block"
  sub_title?: string
  title?: string
  paymentCard?: PaymentCardBlok[]
}

/**
 * The "step" block — nested in an ai_panel's `steps` field.
 */
export interface StepBlok {
  _uid: string
  component?: "step"
  number?: string
  title?: string
  text?: string
}

/**
 * The "ai_panel" block — one AI's content, nested in amethyst_block's `panels`.
 * Text + numbered steps on the left, Bunny video on the right. `tab_label` is
 * the text shown on this panel's switch button in the segmented toggle.
 */
export interface AiPanelBlok {
  _uid: string
  component?: "ai_panel"
  tab_label?: string
  sub_title?: string
  title?: string
  text?: string
  steps?: StepBlok[]
  button?: ButtonBlok[]
  video_id?: string
}

/**
 * The "amethyst_block" — the AI switcher. Holds two (or more) `ai_panel` bloks
 * and shows one at a time; a segmented toggle switches between them and
 * auto-advances every `auto_switch_seconds` (default 15), the active tab's
 * slider filling over that interval.
 */
export interface AmethystBlok {
  _uid: string
  component?: "amethyst_block"
  panels?: AiPanelBlok[]
  auto_switch_seconds?: number
}

/**
 * The "testimonial" block — nested in testimonials_block's `testimonial` field.
 * `country` is a multi-option field, so Storyblok stores it as an array; its
 * values map to flag SVGs via resolveCountryFlag (app/utils).
 */
export interface TestimonialBlok {
  _uid: string
  component?: "testimonial"
  name?: string
  text?: string
  country?: string[]
  video_id?: string
}

/**
 * The "testimonials_block" — titles plus a marquee of testimonial cards.
 */
export interface TestimonialsBlok {
  _uid: string
  component?: "testimonials_block"
  pre_title?: string
  title?: string
  sub_title?: string
  testimonial?: TestimonialBlok[]
}

/**
 * The "teamCard" block — nested in team_block's `teamCard` field.
 * `positioning` picks which side the portrait image sits on.
 */
export interface TeamCardBlok {
  _uid: string
  component?: "teamCard"
  name?: string
  sub_text?: string
  image?: StoryblokAsset
  positioning?: "Left" | "Right"
}

/**
 * The "team_block" — stacked team cards (1/3) beside a rich-text card (2/3).
 */
export interface TeamBlok {
  _uid: string
  component?: "team_block"
  sub_title?: string
  title?: string
  teamCard?: TeamCardBlok[]
  textCard_title?: string
  textCard_textArea?: unknown // Storyblok rich-text document
}

/**
 * The "faq_item" block — nested in faq_block's `faq_item` field.
 */
export interface FaqItemBlok {
  _uid: string
  component?: "faq_item"
  question_title?: string
  answer_text?: string
}

/**
 * The "faq_block" — sub_title/title/text plus a list of collapsible FAQ items.
 */
export interface FaqBlok {
  _uid: string
  component?: "faq_block"
  sub_title?: string
  title?: string
  text_line?: string
  faq_item?: FaqItemBlok[]
}

/**
 * The "cta_block" — centered sub_text / title / handwritten sub_title, two
 * buttons, and a text line, with a 3D beam figure behind the title.
 */
export interface CtaBlok {
  _uid: string
  component?: "cta_block"
  sub_text?: string
  title?: string
  sub_title?: string
  button?: ButtonBlok[]
  text?: string
}

export type ButtonVariant = "primary" | "secondary" | "link"

/**
 * The "button" block — nestable in any blocks-type field (e.g. hero_block.button).
 */
export interface ButtonBlok {
  _uid: string
  component?: "button"
  title?: string
  link?: StoryblokMultilink
  variant?: ButtonVariant
  /**
   * Marks this button as centrally managed. When set, the href comes from the
   * referring affiliate or the config-story default for that role, and the
   * `link` field above is ignored. See `useRoleHref`.
   */
  link_role?: LinkRoleField
}