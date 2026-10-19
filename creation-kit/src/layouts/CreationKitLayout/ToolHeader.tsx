import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

export const ToolHeaderContext = createContext<HTMLElement | null>(null);

export function ToolHeader({ children }: { children: ReactNode }) {
  const target = useContext(ToolHeaderContext);
  return target ? createPortal(children, target) : null;
}
