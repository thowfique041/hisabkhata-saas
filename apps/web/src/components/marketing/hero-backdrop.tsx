/**
 * A khata page behind the hero: faint ruled lines and a margin rule, washed with a soft
 * navy-to-sky gradient that fades out toward the bottom. Purely decorative.
 */
export function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(60rem_30rem_at_85%_-10%,hsl(216_68%_90%/0.9),transparent_70%),radial-gradient(40rem_24rem_at_10%_110%,hsl(158_60%_88%/0.55),transparent_70%)] dark:bg-[radial-gradient(60rem_30rem_at_85%_-10%,hsl(216_60%_30%/0.35),transparent_70%),radial-gradient(40rem_24rem_at_10%_110%,hsl(158_60%_30%/0.18),transparent_70%)]" />
      <div className="absolute inset-0 bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_31px,hsl(var(--border))_31px,hsl(var(--border))_32px)] opacity-70 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
      <div className="absolute inset-y-0 left-[max(1.5rem,calc(50%-36rem))] w-px bg-negative/15 [mask-image:linear-gradient(to_bottom,black,transparent_80%)]" />
    </div>
  );
}
