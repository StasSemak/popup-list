import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "./input";
import { SearchIcon, StarIcon, XIcon } from "lucide-react";
import { getCoins } from "../api/coins";
import { Button } from "./button";
import { cn } from "../lib/utils";
import { fuseSearch } from "../lib/fuse-search";

export function SearchList() {
  const [coins, setCoins] = useState<string[]>([]);
  const [favoriteCoins, setFavoriteCoins] = useState<string[]>([]);
  const [isFavorites, setIsFavorites] = useState<boolean>(false);
  const [searchInput, setSearchInput] = useState<string>("");

  useEffect(() => {
    setCoins(getCoins());
  }, []);

  function isFavorite(coin: string) {
    return favoriteCoins.includes(coin);
  }
  function changeFavoriteStatus(coin: string) {
    if (isFavorite(coin)) {
      setFavoriteCoins((old) => old.filter((x) => x !== coin));
    } else {
      setFavoriteCoins((old) => [...old, coin]);
    }
  }

  const list = useMemo(() => {
    let mapList = isFavorites ? favoriteCoins : coins;
    if (searchInput !== "") {
      mapList = fuseSearch(searchInput, mapList);
    }

    return mapList;
  }, [coins, favoriteCoins, isFavorites, searchInput]);

  function renderCoin(coin: string, idx: number) {
    return(
      <button
        key={coin + idx}
        className="coin-item"
        onClick={() => changeFavoriteStatus(coin)}
      >
        <StarIcon
          className={cn("icon-base", isFavorite(coin) && "icon-fill")}
        />
        <span>{coin}</span>
      </button>
    )
  }

  return (
    <div className="popup-container">
      <div className="search-container">
        <SearchIcon className="icon-lg" strokeWidth={2.25} />
        <Input
          value={searchInput}
          placeholder="Search..."
          autoFocus
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <span 
          className="input-clear" 
          onClick={() => setSearchInput("")}
          style={{display: searchInput ? "block" : "none"}}
        >
          <XIcon className="icon-base" />
        </span>
      </div>
      <div className="favorites-switch">
        <Button className="btn-switch" onClick={() => setIsFavorites(true)}>
          <StarIcon className="icon-base icon-fill" />
          <span className={cn("btn-text", isFavorites && "font-medium")}>
            Favorites
          </span>
        </Button>
        <Button className="btn-switch" onClick={() => setIsFavorites(false)}>
          <span className={cn("btn-text", !isFavorites && "font-medium")}>
            All coins
          </span>
        </Button>
      </div>
      <div className="list-container">
        <VirtualList
          items={list}
          renderItem={renderCoin}
        />
      </div>
    </div>
  );
}

function VirtualList({ items, renderItem }: {
  items: string[],
  renderItem: (coin: string, idx: number) => JSX.Element,
}) {
  const itemHeight = 42;
  const containerHeight = 369;

  const [scroll, setScrollTop] = useState(0);
  const ref = useRef(null);

  const totalHeight = items.length * itemHeight;
  const visibleCount = Math.ceil(containerHeight / itemHeight);

  const start = Math.floor(scroll / itemHeight);
  const endIndex = Math.min(items.length, start + visibleCount);
  const visibleItems = items.slice(start, endIndex);

  const offsetY = start * itemHeight;

  return (
    <div
      ref={ref}
      onScroll={(e) => {
        setScrollTop(e.currentTarget.scrollTop);
      }}
      style={{
        overflowY: "scroll",
        height: `${containerHeight}px`,
        position: "relative",
      }}
      className="hide-scrollbar"
    >
      <div
        style={{
          height: `${totalHeight}px`,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: `${offsetY}px`,
            width: "100%",
          }}
        >
          {visibleItems.map((item, index) => renderItem(item, start + index))}
        </div>
      </div>
    </div>
  );
};