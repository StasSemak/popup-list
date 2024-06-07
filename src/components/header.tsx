import { SearchIcon } from "lucide-react";
import { Button } from "./button";

export function Header() {
  return (
    <header className="h-14 border-b border-zinc-600 flex justify-center bg-zinc-900 py-2">
      <Button>
        <SearchIcon className="size-5 stroke-zinc-300 mr-2" strokeWidth={2.25} />
        <span className="uppercase text-zinc-300">Search</span>
      </Button>
    </header>
  );
}
