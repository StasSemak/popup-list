import { SearchIcon } from "lucide-react";
import { Button } from "./button";

export function Header() {
  return (
    <header>
      <Button>
        <SearchIcon className="icon-base" strokeWidth={2.25} />
        <span className="btn-text">Search</span>
      </Button>
    </header>
  );
}
