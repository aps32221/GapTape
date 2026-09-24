import { useEffect, useState } from "react";

function storageKey(address?: string) {
  return address ? `gaptape:positions:${address.toLowerCase()}` : null;
}

export function useMyPositions(address?: string) {
  const [ids, setIds] = useState<number[]>([]);

  useEffect(() => {
    const key = storageKey(address);
    if (!key) {
      setIds([]);
      return;
    }
    try {
      const raw = localStorage.getItem(key);
      setIds(raw ? JSON.parse(raw) : []);
    } catch {
      setIds([]);
    }
  }, [address]);

  function add(id: number) {
    const key = storageKey(address);
    if (!key) return;
    setIds((prev) => {
      const next = Array.from(new Set([...prev, id])).sort((a, b) => a - b);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // best-effort convenience cache only
      }
      return next;
    });
  }

  return { ids, add };
}
