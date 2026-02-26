import "./globals.css";

export const metadata = {
  title: "TEREX AI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#040b1a] text-white">{children}</body>
    </html>
  );
}