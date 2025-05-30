function setTheme(themeFile) {
  const link = document.getElementById('theme-link');
  if (link) {
    link.href = '/' + themeFile;
    localStorage.setItem('selectedTheme', themeFile);
  }
}

window.setTheme = setTheme;

window.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('selectedTheme');
  if (savedTheme) {
    setTheme(savedTheme);
  }
});