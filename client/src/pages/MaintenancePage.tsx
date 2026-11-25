import { Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MaintenancePage() {
  const retry = () => window.location.reload();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <div
        className="w-full max-w-md rounded-2xl border-4 border-foreground/20 p-8 text-center box-shadow-game"
        style={{
          background: "linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--muted)) 100%)",
        }}
      >
        <div className="mb-6 flex justify-center">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-primary bg-primary/15"
            aria-hidden
          >
            <Wrench className="h-10 w-10 text-primary" strokeWidth={2.5} />
          </div>
        </div>
        <h1
          className="text-4xl font-display font-bold tracking-wide text-foreground text-shadow-lg mb-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Under the hood
        </h1>
        <p className="text-lg text-muted-foreground font-medium mb-6" style={{ fontFamily: "var(--font-body)" }}>
          Server maintenance — we&apos;ll be back shortly.
        </p>
        <p className="text-sm text-muted-foreground/80 mb-8">
          Thanks for your patience. Try again in a moment.
        </p>
        <Button
          onClick={retry}
          className="flash-btn w-full font-display text-xl h-12 bg-primary text-primary-foreground hover:bg-primary/90 border-2 border-foreground/20"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Try again
        </Button>
      </div>
    </div>
  );
}
