import "@fontsource/manrope/index.css";
import "./globals.css";


export const metadata = {
  title: "GridNomad Atlas",
  description: "Dark premium browser sandbox for watching AI-controlled human groups think, move, and interact."
};


export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="font-sans bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
