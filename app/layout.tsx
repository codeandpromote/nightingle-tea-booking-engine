import type { Metadata } from 'next';
import {
  Cormorant_Garamond,
  Plus_Jakarta_Sans,
  JetBrains_Mono,
} from 'next/font/google';
import './globals.css';

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Nightingale Tea Tourism · Estate Booking & Management Portal',
  description:
    'Enterprise multi-estate tea tourism booking engine, Razorpay & Manual UPI payment portal, Admin management console, and Shared-cPanel PHP 8.x deployment package for Nightingaletea.com.',
  openGraph: {
    title: 'Nightingale Tea Tourism · Estate Booking & Management Portal',
    description:
      'Reserve colonial heritage bungalows and cottages across Mateli, Jainti, and Chuapara Tea Estates with instant Razorpay or zero-fee UPI settlement.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nightingale Tea Tourism · Estate Booking & Management Portal',
    description:
      'Reserve colonial heritage bungalows and cottages across Mateli, Jainti, and Chuapara Tea Estates.',
  },
};

const FETCH_EXTENSION_GUARD = `(function(){try{var d=Object.getOwnPropertyDescriptor(window,'fetch');if(d&&typeof d.get==='function'&&!d.set&&d.configurable){var og=d.get,ov=null;Object.defineProperty(window,'fetch',{configurable:true,enumerable:d.enumerable!==false,get:function(){return ov||og.call(this);},set:function(fn){if(typeof fn==='function'){ov=fn;}}});}}catch(_){}window.addEventListener('error',function(e){if(e&&typeof e.filename==='string'&&e.filename.indexOf('chrome-extension://')===0){e.preventDefault();e.stopImmediatePropagation();}},true);})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${plusJakarta.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: FETCH_EXTENSION_GUARD }} />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-screen bg-[#FAFAF8] text-[#141C17] font-[family-name:var(--font-sans)] antialiased selection:bg-[#1B4332] selection:text-white"
      >
        {children}
      </body>
    </html>
  );
}
