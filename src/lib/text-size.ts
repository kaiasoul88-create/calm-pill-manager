const KEY = "pastillero-text-size";

export function applyTextSize(size: string) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-text-size", size);
  try {
    localStorage.setItem(KEY, size);
  } catch {
    /* almacenamiento no disponible */
  }
}

export function storedTextSize(): string {
  if (typeof localStorage === "undefined") return "normal";
  try {
    return localStorage.getItem(KEY) ?? "normal";
  } catch {
    return "normal";
  }
}
