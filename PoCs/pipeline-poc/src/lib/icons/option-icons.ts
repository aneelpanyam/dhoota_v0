/**
 * Central registry for option icons.
 *
 * Icons are stored in option_definitions.icon and must reference a Lucide icon
 * that exists in this registry. This ensures:
 * 1. No duplicate/confusing fallbacks (e.g. multiple Zap icons)
 * 2. DB values are validated against known icons
 * 3. Aliases handle legacy or alternate names (e.g. TagIcon -> Tags, Image -> ImageIcon)
 *
 * When adding new options, use an icon from VALID_OPTION_ICONS.
 * Run `npm run db:validate-icons` (if added) to check option_definitions.icon values.
 */

import {
  Activity,
  BarChart3,
  Bookmark,
  BookmarkMinus,
  Building2,
  Calendar,
  CalendarDays,
  CalendarPlus,
  CheckSquare,
  CreditCard,
  DollarSign,
  Eye,
  FileBarChart,
  FileText,
  Globe,
  HelpCircle,
  Image as ImageIcon,
  Info,
  Key,
  LayoutGrid,
  List,
  Megaphone,
  MessageCircle,
  MessageSquare,
  MessageSquarePlus,
  Pencil,
  Pin,
  Plus,
  PlusCircle,
  RefreshCw,
  Reply,
  Search,
  Settings,
  Share2,
  ShieldOff,
  SlidersHorizontal,
  Smartphone,
  Tags,
  Trash2,
  ToggleLeft,
  User,
  UserCircle,
  UserCog,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";

export type OptionIconComponent = React.ComponentType<{ className?: string }>;

/** Icons available for options. Keys match option_definitions.icon in DB. */
const OPTION_ICON_MAP: Record<string, OptionIconComponent> = {
  Activity,
  BarChart3,
  Bookmark,
  BookmarkMinus,
  Bookmarks: Bookmark,
  Building2,
  Calendar,
  CalendarDays,
  CalendarPlus,
  CheckSquare,
  CreditCard,
  DollarSign,
  Eye,
  FileBarChart,
  FileText,
  Globe,
  HelpCircle,
  Image: ImageIcon,
  Info,
  Key,
  LayoutGrid,
  List,
  Megaphone,
  MessageCircle,
  MessageSquare,
  MessageSquarePlus,
  Pencil,
  Pin,
  Plus,
  PlusCircle,
  RefreshCw,
  Reply,
  Search,
  Settings,
  Share2,
  ShieldOff,
  Sliders: SlidersHorizontal,
  SlidersHorizontal,
  Smartphone,
  TagIcon: Tags,
  Tags,
  Trash2,
  ToggleLeft,
  User,
  UserCircle,
  UserCog,
  UserPlus,
  Users,
  Zap,
};

/** Fallback when icon is missing or invalid. Use a generic "action" icon. */
const FALLBACK_ICON = Zap;

/** Icon names that are valid in option_definitions.icon. Use these when adding options. */
export const VALID_OPTION_ICONS = [...new Set(Object.keys(OPTION_ICON_MAP))] as string[];

/**
 * Resolve an icon name from the DB to a Lucide component.
 * Returns the component or FALLBACK_ICON if the name is not in the registry.
 */
export function getOptionIcon(iconName: string | null | undefined): OptionIconComponent {
  if (!iconName || typeof iconName !== "string") return FALLBACK_ICON;
  const trimmed = iconName.trim();
  if (!trimmed) return FALLBACK_ICON;
  return OPTION_ICON_MAP[trimmed] ?? FALLBACK_ICON;
}

/**
 * Check if an icon name is valid (exists in our registry).
 */
export function isValidOptionIcon(iconName: string | null | undefined): boolean {
  if (!iconName || typeof iconName !== "string") return false;
  const trimmed = iconName.trim();
  return trimmed in OPTION_ICON_MAP;
}
