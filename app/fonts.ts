import localFont from 'next/font/local';

export const dmSans = localFont({
  src: [
    { path: '../public/fonts/DM_Sans/DMSans-Variable.ttf', style: 'normal' },
    { path: '../public/fonts/DM_Sans/DMSans-Italic-Variable.ttf', style: 'italic' },
  ],
  variable: '--font-dm-sans',
  display: 'swap',
});

export const spectral = localFont({
  src: [
    { path: '../public/fonts/Spectral/Spectral-Regular.ttf', weight: '400', style: 'normal' },
    { path: '../public/fonts/Spectral/Spectral-Italic.ttf', weight: '400', style: 'italic' },
    { path: '../public/fonts/Spectral/Spectral-Medium.ttf', weight: '500', style: 'normal' },
    { path: '../public/fonts/Spectral/Spectral-SemiBold.ttf', weight: '600', style: 'normal' },
  ],
  variable: '--font-spectral',
  display: 'swap',
});
