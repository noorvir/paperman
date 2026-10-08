import { cva } from "class-variance-authority";

export const statusTone = cva("", {
  variants: {
    tone: {
      neutral: "border-border bg-secondary text-muted-foreground",
      success:
        "border-success-foreground/35 bg-success text-success-foreground",
      attention:
        "border-attention-foreground/35 bg-attention text-attention-foreground",
      destructive: "border-destructive/35 bg-destructive/10 text-destructive",
    },
    interactive: { true: "", false: "" },
  },
  compoundVariants: [
    {
      tone: "neutral",
      interactive: true,
      className: "hover:bg-accent hover:text-accent-foreground",
    },
    {
      tone: "success",
      interactive: true,
      className:
        "hover:bg-[color-mix(in_oklch,var(--success),var(--success-foreground)_10%)] focus-visible:border-success-foreground focus-visible:ring-success-foreground/25",
    },
    {
      tone: "attention",
      interactive: true,
      className:
        "hover:bg-[color-mix(in_oklch,var(--attention),var(--attention-foreground)_10%)] focus-visible:border-attention-foreground focus-visible:ring-attention-foreground/25",
    },
    {
      tone: "destructive",
      interactive: true,
      className:
        "hover:bg-destructive/20 focus-visible:border-destructive focus-visible:ring-destructive/25",
    },
  ],
});
