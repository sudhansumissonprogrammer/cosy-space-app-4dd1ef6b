import { createContext, useContext } from "react";

/** A mounted, activation-gated card has already earned its image request. */
export const CardImageReadiness = createContext(false);
export function useCardImageReadiness() {
  return useContext(CardImageReadiness);
}