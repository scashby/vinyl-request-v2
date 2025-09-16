import "./globals.css";
import "styles/media-grading.css"; // Added for grading page styles

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
