import { useRef, useEffect } from 'react';

export function useTimerRefs() {
  const timers = useRef<NodeJS.Timeout[]>([]);

  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, []);

  const addTimer = (callback: () => void, ms: number) => {
    const id = setTimeout(callback, ms);
    timers.current.push(id);
    return id;
  };

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  return { addTimer, clearTimers };
}
