import Link from "next/link";
import { Button, type ButtonProps } from "@/components/ui/button";

type ButtonLinkProps = ButtonProps & {
  href: string;
};

/** Navigation link styled as a button (outline by default). */
export function ButtonLink({ href, variant = "outline", size, className, children, ...props }: ButtonLinkProps) {
  return (
    <Button asChild variant={variant} size={size} className={className} {...props}>
      <Link href={href}>{children}</Link>
    </Button>
  );
}
