"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    setMounted(true);
    
    // 1. Theme initialization
    const savedTheme = localStorage.getItem("theme") as 'light' | 'dark';
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    }

    // 2. Auth checking
    const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
    if (!isLoggedIn && pathname !== "/login" && pathname !== "/signup") {
      router.push("/login");
    }
  }, [pathname, router]);

  if (!mounted) {
    return (
      <html lang="en" data-theme="dark">
        <body>{children}</body>
      </html>
    );
  }

  return (
    <html lang="en" data-theme={theme}>
       <head>
        <title>Invoice Scanner AI</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
