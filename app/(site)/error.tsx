"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // In production this should report to an error-tracking service.
    console.error(error);
  }, [error]);

  return (
    <div className="container flex flex-col items-center justify-center py-24 text-center">
      <AlertTriangle className="mb-6 h-14 w-14 text-destructive" aria-hidden="true" />
      <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Something went wrong.</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        An unexpected error occurred while loading this page (500). Our team has been notified. You can try again or
        head back home.
      </p>

      <div className="mt-8 flex gap-3">
        <Button onClick={() => reset()}>Try Again</Button>
        <Button asChild variant="outline">
          <Link href="/">Back to Home</Link>
        </Button>
      </div>
    </div>
  );
}
