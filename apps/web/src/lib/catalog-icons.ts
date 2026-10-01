import { z } from "zod";
import {
  File01Icon,
  Invoice01Icon,
  Shield01Icon,
  BankIcon,
  HeartPulseIcon,
  FlashIcon,
  FileEditIcon,
  Home01Icon,
  Car01Icon,
  Briefcase01Icon,
  Mortarboard01Icon,
  Airplane01Icon,
  FileSpreadsheetIcon,
} from "@hugeicons/core-free-icons";
import type { components } from "./schema";

type CatalogIcon = components["schemas"]["CatalogEntry"]["icon"];

export const catalogIcons = {
  auto: { label: "Automatic", icon: File01Icon },
  file: { label: "Document", icon: File01Icon },
  receipt: { label: "Invoice", icon: Invoice01Icon },
  shield: { label: "Insurance", icon: Shield01Icon },
  bank: { label: "Banking", icon: BankIcon },
  health: { label: "Health", icon: HeartPulseIcon },
  utilities: { label: "Utilities", icon: FlashIcon },
  contract: { label: "Contract", icon: FileEditIcon },
  home: { label: "Home", icon: Home01Icon },
  car: { label: "Car", icon: Car01Icon },
  business: { label: "Business", icon: Briefcase01Icon },
  education: { label: "Education", icon: Mortarboard01Icon },
  travel: { label: "Travel", icon: Airplane01Icon },
  tax: { label: "Tax", icon: FileSpreadsheetIcon },
} satisfies Record<CatalogIcon, { label: string; icon: typeof File01Icon }>;

export const catalogIconInput = z.custom<CatalogIcon>(
  (value) => typeof value === "string" && Object.hasOwn(catalogIcons, value),
  "Choose an icon from the list",
);

export function getTagIcon(
  tag: components["schemas"]["CatalogEntry"] | undefined,
) {
  if (!tag) {
    return File01Icon;
  }
  if (tag.icon !== "auto") {
    return catalogIcons[tag.icon].icon;
  }
  const defaults = new Map<string, CatalogIcon>([
    ["invoice", "receipt"],
    ["insurance", "shield"],
    ["banking", "bank"],
    ["tax", "tax"],
    ["health", "health"],
    ["utilities", "utilities"],
    ["contract", "contract"],
  ]);
  return catalogIcons[defaults.get(tag.id) ?? "file"].icon;
}

export function getDocumentTags(
  document: components["schemas"]["Document"],
  catalog: components["schemas"]["Catalog"],
) {
  const selected = new Set([
    ...document.generated_tags.filter(
      (id) => !document.excluded_tags.includes(id),
    ),
    ...document.user_tags,
  ]);
  return catalog.tags.filter((tag) => selected.has(tag.id));
}
