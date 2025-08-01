import { Heart } from "lucide-react";

export function Footer() {
  return (
    <footer className="py-6 md:px-8 md:py-0">
      <div className="container flex flex-col items-center justify-center gap-4 md:h-24 md:flex-row">
        <p className="text-balance text-center text-sm leading-loose text-muted-foreground md:text-left flex items-center">
          Made with &nbsp;
          <Heart className="h-4 w-4 fill-current text-red-500" />
          &nbsp; by HHF Technology for the beloved community.
        </p>
      </div>
    </footer>
  );
}