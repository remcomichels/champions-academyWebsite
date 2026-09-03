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
 * The "faq_item" block — nested in faq_block's `faq_item` field.
 */
export interface FaqItemBlok {
  _uid: string
  component?: "faq_item"
  question_title?: string
  answer_text?: string
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