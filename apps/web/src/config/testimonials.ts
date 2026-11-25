/**
 * Quotes from real HisabKhata customers, shown on the home page.
 * TODO: add real testimonials with the customer's written permission. Never invent names, shops
 * or quotes. While this list is empty the section is not rendered at all.
 */
export interface Testimonial {
  quote: { en: string; bn: string };
  name: string;
  /** e.g. "Owner, Rahman General Store, Sylhet". */
  role: { en: string; bn: string };
  /** Optional photo under /public, used only with permission. */
  photo?: string;
}

export const TESTIMONIALS: Testimonial[] = [];
