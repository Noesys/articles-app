import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const positions = new Map<string, number>();

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