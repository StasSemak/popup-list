import { SearchIcon } from "lucide-react";
import { Button } from "./button";
import { SearchList } from "./search-list";
import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../lib/utils";

export function Header() {
  const [isPopupVisible, setIsPopupVisible] = useState<boolean>(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  useOustsideClick(ref, () => setIsPopupVisible(false), btnRef);
  useEscPress(() => setIsPopupVisible(false));

  return (
    <header>
      <div className="popup-trigger">
        <Button onClick={() => setIsPopupVisible((old) => !old)} ref={btnRef}>
          <SearchIcon className="icon-base" strokeWidth={2.25} />
          <span className="btn-text">Search</span>
        </Button>
        <SearchList className={cn(isPopupVisible ? "popup-visible" : "popup-hidden")} ref={ref}/>
      </div>
    </header>
  );
}

function useOustsideClick(ref: RefObject<HTMLDivElement>, onClick: () => void, btnRef: RefObject<HTMLButtonElement>) {
  const onMouseDown = useCallback((e: MouseEvent) => {
    const target = e.target as Node;
    if(!target || !ref.current || !btnRef.current) return;

    const isOutside = !ref.current.contains(target) && !btnRef.current.contains(target);

    if(isOutside) {
      onClick();
    }
  }, [ref, btnRef])
  
  useEffect(() => {
    window.addEventListener("mousedown", onMouseDown);

    return () => {
      window.removeEventListener("mousedown", onMouseDown);
    }
  }, [])
}
function useEscPress(onClick: () => void) {
  const onEscPress = useCallback((e: KeyboardEvent) => {
    if(e.key === "Escape") {
      onClick();
    }
  }, [])
  
  useEffect(() => {
    window.addEventListener("keydown", onEscPress);

    return () => {
      window.removeEventListener("keydown", onEscPress);
    }
  }, [])
}