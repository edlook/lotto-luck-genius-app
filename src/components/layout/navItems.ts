import { ChartColumn, CalendarDays, Dices, Info, Percent, Settings, Ticket, type LucideIcon } from "lucide-react";

export interface NavItem {
  to: string;
  /** i18n key of the label. */
  key: string;
  icon: LucideIcon;
}

/** Bottom bar (phones) and the first block of the sidebar: the 5 main screens (site-structure.md §3.1). */
export const MAIN_NAV: readonly NavItem[] = [
  { to: "/", key: "nav.generator", icon: Dices },
  { to: "/tickets", key: "nav.tickets", icon: Ticket },
  { to: "/draws", key: "nav.draws", icon: CalendarDays },
  { to: "/stats", key: "nav.stats", icon: ChartColumn },
  { to: "/odds", key: "nav.odds", icon: Percent },
];

/** Menu (phones) and the second block of the sidebar. */
export const SECONDARY_NAV: readonly NavItem[] = [
  { to: "/about", key: "nav.about", icon: Info },
  { to: "/settings", key: "nav.settings", icon: Settings },
];
