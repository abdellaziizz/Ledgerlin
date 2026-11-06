import { Link } from "react-router";
import { buttonStyles } from "@/components/ui/Button";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="font-mono text-[13px] text-ink-3">404</div>
      <h1 className="mt-2 text-[22px] font-semibold tracking-[-0.02em] text-ink">This page doesn't exist</h1>
      <p className="mt-1.5 text-[13.5px] text-ink-3">Check the address, or head back to your overview.</p>
      <Link to="/" className={buttonStyles({ variant: "primary", className: "mt-6" })}>Go to overview</Link>
    </div>
  );
}
