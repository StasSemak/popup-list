import Fuse from "fuse.js";

const fuse = new Fuse([] as string[]);

export function fuseSearch(input: string, collection: string[]) {
  fuse.setCollection(collection);
  return fuse.search(input).map((value) => value.item);
}
