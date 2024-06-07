import { Search as SearchIcon } from "lucide-react";
import { Button } from "./button";

export function Header() {
  return (
    <header className="h-14 border-b border-zinc-100 flex justify-center bg-zinc-900 py-2">
      <Button>
        <SearchIcon className="size-5 stroke-zinc-100 mr-2" />
        <span className="uppercase">Search</span>
      </Button>
    </header>
  );
}
