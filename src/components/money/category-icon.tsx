import {
  Car, CircleEllipsis, Clapperboard, Coffee, HeartPulse, PiggyBank, Receipt, ShoppingBag, TrendingUp, Utensils, Wallet,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  utensils: Utensils,
  coffee: Coffee,
  car: Car,
  "shopping-bag": ShoppingBag,
  receipt: Receipt,
  clapperboard: Clapperboard,
  "heart-pulse": HeartPulse,
  "circle-ellipsis": CircleEllipsis,
  wallet: Wallet,
  "trending-up": TrendingUp,
  "piggy-bank": PiggyBank,
};

export function CategoryIcon({ name, className }: { name: string | null; className?: string }) {
  const Icon = (name && ICONS[name]) || CircleEllipsis;
  return <Icon className={className} aria-hidden />;
}
