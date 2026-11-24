import Link from 'next/link';
import { Logo } from '@/components/logo';
import { MarketingNav } from './nav';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <MarketingNav />
      <main className="flex-1">{children}</main>
      <footer className="border-t bg-background">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 sm:grid-cols-[1fr_auto_auto]">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">Inventory, point of sale and invoicing for shops and wholesalers in Bangladesh.</p>
          </div>
          <nav className="flex flex-col gap-2 text-sm" aria-label="Product">
            <Link href="/features" className="text-muted-foreground hover:text-foreground">Features</Link>
            <Link href="/pricing" className="text-muted-foreground hover:text-foreground">Pricing</Link>
            <Link href="/register" className="text-muted-foreground hover:text-foreground">Create account</Link>
          </nav>
          <nav className="flex flex-col gap-2 text-sm" aria-label="Company">
            <Link href="/about" className="text-muted-foreground hover:text-foreground">About</Link>
            <Link href="/contact" className="text-muted-foreground hover:text-foreground">Contact</Link>
            <Link href="/login" className="text-muted-foreground hover:text-foreground">Sign in</Link>
          </nav>
        </div>
        <p className="border-t px-6 py-4 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} HisabKhata. Made in Bangladesh.</p>
      </footer>
    </div>
  );
}
