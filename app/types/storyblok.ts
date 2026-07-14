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