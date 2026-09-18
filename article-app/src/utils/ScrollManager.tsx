import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const positions = new Map<string, number>();

/**
 * For pages whose content loads asynchronously and grows taller over time
 * (e.g. infinite-scroll lists replaying several pages after a back
 * navigation): this component's own restore below fires on mount, before
 * that content exists to scroll into. Callers can re-apply the saved
 * position themselves once their content has caught up, using the same
 * pathname+search key this component records under.
 */
export function getSavedScrollPosition(key: string): number | undefined {
  return positions.get(key);
}

export default function ScrollManager() {
  const location = useLocation();
  const navType = useNavigationType(); 
  const key = location.pathname + location.search;

  const prevKey = useRef(key);
  useEffect(() => {
    return () => {
      positions.set(prevKey.current, window.scrollY);
    };
  }, [key]);
  prevKey.current = key;

  useLayoutEffect(() => {
    if (navType === "POP" && positions.has(key)) {
      window.scrollTo(0, positions.get(key)!);
    } else {
      window.scrollTo(0, 0);
    }
  }, [key, navType]);

  return null;
}