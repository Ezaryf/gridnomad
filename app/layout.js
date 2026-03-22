import "./globals.css";


export const metadata = {
  title: "GridNomad Control Room",
  description: "Browser interface for the GridNomad civilization simulator."
};


export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
