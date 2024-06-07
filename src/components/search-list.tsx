import { useEffect, useState } from "react";
import { Input } from "./input";
import { Search as SearchIcon } from "lucide-react";
import { getCoins } from "../api/coins";

export function SearchList() {
  const [coins, setCoins] = useState<string[]>([]);

  useEffect(() => {
    setCoins(getCoins());
  }, [])

  return (
    <div className="flex flex-col w-80 border border-zinc-600 rounded-xl py-1">
      <div className="flex items-center border-b border-zinc-600 px-3">
        <SearchIcon className="size-5 stroke-zinc-300 -mr-0.5" strokeWidth={2.25} />
        <Input 
          placeholder="Search..."
          autoFocus
        />
      </div>
      <div>{coins[0]}</div>
    </div>
  );
}
