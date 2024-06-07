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
    <div className="flex flex-col w-80 border border-zinc-600 rounded-xl py-1">
      <div className="flex items-center border-b border-zinc-600 px-3 pb-1">
        <SearchIcon className="size-6 stroke-zinc-300 -mr-0.5" strokeWidth={2.25} />
        <Input 
          placeholder="Search..."
          autoFocus
        />
      </div>
      <div className="flex gap-4 px-3 pt-2 w-full">
        <Button 
          className="gap-2 py-0.5" 
          onClick={() => setIsFavorites(true)}
        >
          <StarIcon className="size-5 stroke-zinc-300 fill-zinc-300" />
          <span className={cn("uppercase", isFavorites && "font-medium")}>Favorites</span>
        </Button>
        <Button 
          className="py-0.5" 
          onClick={() => setIsFavorites(false)}
        >
          <span className={cn("uppercase", !isFavorites && "font-medium")}>All coins</span>
        </Button>
      </div>
      <div>{coins[0]}</div>
    </div>
  );
}
