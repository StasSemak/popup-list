import { useEffect, useMemo, useState } from "react";
import { Input } from "./input";
import { SearchIcon, StarIcon } from "lucide-react";
import { getCoins } from "../api/coins";
import { Button } from "./button";
import { cn } from "../lib/utils";

export function SearchList() {
  const [coins, setCoins] = useState<string[]>([]);
  const [favoriteCoins, setFavoriteCoins] = useState<string[]>([]);
  const [isFavorites, setIsFavorites] = useState<boolean>(false);

  useEffect(() => {
    setCoins(getCoins());
  }, []);

  function isFavorite(coin: string) {
    return favoriteCoins.includes(coin);
  }
  function changeFavoriteStatus(coin: string) {
    if(isFavorite(coin)) {
      setFavoriteCoins((old) => old.filter(x => x !== coin));
    }
    else {
      setFavoriteCoins((old) => [...old, coin]);
    }
  }

  const list = useMemo(() => {
    const mapList = isFavorites ? favoriteCoins : coins; 
    return mapList.map((coin, idx) => (
      <button key={coin + idx} className="coin-item" onClick={() => changeFavoriteStatus(coin)}>
        <StarIcon className={cn("icon-base", isFavorite(coin) && "icon-fill")} />
        <span className="btn-text">{coin}</span>
      </button>
    ))
  }, [coins, favoriteCoins, isFavorites]);

  return (
    <div className="popup-container">
      <div className="search-container">
        <SearchIcon className="icon-lg" strokeWidth={2.25} />
        <Input placeholder="Search..." autoFocus />
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
        {list}
      </div>
    </div>
  );
}