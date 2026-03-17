const darkThemeQuery = globalThis.matchMedia
  ? globalThis.matchMedia("(prefers-color-scheme: dark)")
  : null;

function syncTheme() {
  const theme = darkThemeQuery?.matches ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", theme);
}

syncTheme();

if (darkThemeQuery) {
  const onThemeChange = () => syncTheme();
  if (typeof darkThemeQuery.addEventListener === "function") {
    darkThemeQuery.addEventListener("change", onThemeChange);
  } else if (typeof darkThemeQuery.addListener === "function") {
    darkThemeQuery.addListener(onThemeChange);
  }
}
