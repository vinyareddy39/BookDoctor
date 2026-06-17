import { useState } from "react";

export default function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : initialValue;
  });

  const setItem = (val) => {
    setValue(val);
    localStorage.setItem(key, JSON.stringify(val));
  };

  const removeItem = () => {
    setValue(null);
    localStorage.removeItem(key);
  };

  return [value, setItem, removeItem];
}