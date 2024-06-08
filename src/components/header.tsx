import { SearchIcon } from "lucide-react";
import { Button } from "./button";
import { SearchList } from "./search-list";
import { useState } from "react";
import { cn } from "../lib/utils";

export function Header() {
  const [isPopupVisible, setIsPopupVisible] = useState<boolean>(false);

  return (
    <header>
      <div className="popup-trigger">
        <Button onClick={() => setIsPopupVisible((old) => !old)}>
          <SearchIcon className="icon-base" strokeWidth={2.25} />
          <span className="btn-text">Search</span>
        </Button>
        <SearchList className={cn(isPopupVisible ? "popup-visible" : "popup-hidden")}/>
      </div>
    </header>
  );
}