import { useEffect, useState } from "react";
import { Input } from "./input";
import { SearchIcon, StarIcon } from "lucide-react";
import { getCoins } from "../api/coins";
import { Button } from "./button";
import { cn } from "../lib/utils";

export function SearchList() {
  const [coins, setCoins] = useState<string[]>([]);
  const [isFavorites, setIsFavorites] = useState<boolean>(false); 

  useEffect(() => {
    setCoins(getCoins());
  }, [])

  return (
    <div className="popup-container">
      <div className="search-container">
        <SearchIcon className="icon-lg" strokeWidth={2.25} />
        <Input 
          placeholder="Search..."
          autoFocus
        />
      </div>
      <div className="favorites-switch">
        <Button 
          className="btn-switch" 
          onClick={() => setIsFavorites(true)}
        >
          <StarIcon className="icon-base icon-fill" />
          <span className={cn("btn-text", isFavorites && "font-medium")}>Favorites</span>
        </Button>
        <Button 
          className="btn-switch" 
          onClick={() => setIsFavorites(false)}
        >
          <span className={cn("btn-text", !isFavorites && "font-medium")}>All coins</span>
        </Button>
      </div>
      <div>{coins[0]}</div>
    </div>
  );
}
