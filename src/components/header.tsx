import { SearchIcon } from "lucide-react";
import { Button } from "./button";
import { SearchList } from "./search-list";
import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../lib/utils";

export function Header() {
  return (
    <header>
      <Popup/>
      <Popup/>
      <Popup/>
    </header>
  );
}

function Popup() {
  const [isPopupOpen, setIsPopupVisible] = useState<boolean>(false);
  const [isLeft, setIsLeft] = useState<boolean>(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  useOutsideClick(ref, () => setIsPopupVisible(false), btnRef);
  useEscPress(() => {
    setIsPopupVisible(false);
    btnRef.current?.focus();
  });

  function onBtnClick() {
    setIsPopupVisible((old) => !old);
    btnRef.current?.blur();
  }

  useEffect(() => {
    if (!ref.current || !btnRef.current) return;
    const btnOffset =
      btnRef.current.getBoundingClientRect().left +
      btnRef.current.getBoundingClientRect().width;
    const popupWidth = ref.current.getBoundingClientRect().width;
    setIsLeft(btnOffset - popupWidth < 0);
  }, [ref, btnRef]);

  return (
    <div className="popup-trigger">
      <Button
        onClick={onBtnClick}
        ref={btnRef}
        className={cn("trigger-btn", isPopupOpen && "trigger-open")}
      >
        <SearchIcon className="icon-base" strokeWidth={2.25} />
        <span className="btn-text">Search</span>
      </Button>
      <SearchList
        className={cn(
          isPopupOpen ? "popup-visible" : "popup-hidden",
          isLeft ? "popup-left" : "popup-right"
        )}
        ref={ref}
        isOpen={isPopupOpen}
      />
    </div>
  );
}

function useOutsideClick(
  ref: RefObject<HTMLDivElement>,
  onClick: () => void,
  btnRef: RefObject<HTMLButtonElement>
) {
  const onMouseDown = useCallback(
    (e: MouseEvent) => {
      const target = e.target as Node;
      if (!target || !ref.current || !btnRef.current) return;

      const isOutside =
        !ref.current.contains(target) && !btnRef.current.contains(target);

      if (isOutside) {
        onClick();
      }
    },
    [ref, btnRef]
  );

  useEffect(() => {
    window.addEventListener("mousedown", onMouseDown);

    return () => {
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, []);
}
function useEscPress(onClick: () => void) {
  const onEscPress = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      onClick();
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", onEscPress);

    return () => {
      window.removeEventListener("keydown", onEscPress);
    };
  }, []);
}
