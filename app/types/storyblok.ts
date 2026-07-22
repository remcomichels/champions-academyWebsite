// types/storyblok.ts

export type StoryblokLinkType = "story" | "url" | "email" | "asset"

export interface StoryblokMultilink {
  id?: string
  url?: string
  linktype: StoryblokLinkType
  fieldtype?: "multilink"
  cached_url?: string
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
}

export interface LogoItem {
  _uid: string
  component?: "logo"
  logo?: StoryblokAsset
}

export type HeaderMenuItem = MenuLinkItem
export type CtaMenuItem = MenuLinkItem

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
  subText_button?: string
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
 * The "step" block — nested in amethyst_block's `steps` field.
 */
export interface StepBlok {
  _uid: string
  component?: "step"
  number?: string
  title?: string
  text?: string
}

/**
 * The "amethyst_block" — text + numbered steps on the left, Bunny video right.
 */
export interface AmethystBlok {
  _uid: string
  component?: "amethyst_block"
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
}