import { SearchIcon } from "lucide-react";
import { Button } from "./button";
import { SearchList } from "./search-list";
import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../lib/utils";
import { createPortal } from "react-dom";

export function Header() {
  return (
    <header>
      <Popup/>
      <Popup/>
    </header>
  );
}

function Popup() {
  const [isPopupOpen, setIsPopupVisible] = useState<boolean>(false);
  const ref = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
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

  const setPortalPosition = useCallback(() => {
    if (!ref.current || !btnRef.current || !portalRef.current) return;
    const btnOffset = btnRef.current.getBoundingClientRect().left;
    const btnWidth = btnRef.current.getBoundingClientRect().width;
    const popupWidth = ref.current.getBoundingClientRect().width;
    const isLeft = (btnOffset + btnWidth) - popupWidth < 0;

    let tx: number;
    if(isLeft) tx = btnOffset;
    else tx = btnOffset + btnWidth - popupWidth;
    
    const ty = 
      btnRef.current.getBoundingClientRect().top +
      btnRef.current.getBoundingClientRect().height
    
    portalRef.current.style.transform = `translate(${tx}px, ${ty}px)`;
  }, [ref, btnRef, portalRef]);

  useEffect(() => {
    setPortalPosition();
  }, [ref, btnRef, portalRef, isPopupOpen]);

  useEffect(() => {
    window.addEventListener("resize", setPortalPosition);

    return () => {
      window.removeEventListener("resize", setPortalPosition);
    }
  }, [])

  return (
    <>
      <Button
        onClick={onBtnClick}
        ref={btnRef}
        className={cn("trigger-btn", isPopupOpen && "trigger-open")}
      >
        <SearchIcon className="icon-base" strokeWidth={2.25} />
        <span className="btn-text">Search</span>
      </Button>
      {isPopupOpen &&
        createPortal(
          <div 
            ref={portalRef}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              minWidth: "max-content",
              zIndex: 999,
            }}
          >
            <SearchList
              ref={ref}
              isOpen={isPopupOpen}
            />
          </div>,
          document.body,
        )
      }
    </>
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
