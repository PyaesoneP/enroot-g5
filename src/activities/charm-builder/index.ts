import type { ActivityModule } from "../types";
import { CharmBuilder } from "./charm-builder";
import { parsePicks, serializePicks, type Picks } from "./picks";

export const charmBuilder: ActivityModule<Picks> = {
  id: "charm-builder",
  name: "Make your bracelet",
  Component: CharmBuilder,
  parse: parsePicks,
  serialize: serializePicks,
};
