import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "default" | "primary" | "success" | "ghost" | "danger";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
  block?: boolean;
  children: ReactNode;
}

const variantClass: Record<Variant, string> = {
  default: "",
  primary: "btn-primary",
  success: "btn-success",
  ghost: "btn-ghost",
  danger: "btn-danger",
};

export function Button({
  variant = "default",
  size = "md",
  block = false,
  className = "",
  children,
  type = "button",
  ...rest
}: Props) {
  const classes = [
    "btn",
    variantClass[variant],
    size === "sm" ? "btn-sm" : "",
    block ? "btn-block" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
