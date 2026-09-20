// src/lib/socialIcons.tsx
// Icon lookup for social links stored as plain {name, url} data (Footer,
// the homepage Connect section, and the admin editor all share this so a
// social platform's icon is defined in exactly one place).

import { ComponentType } from 'react';
import {
  SiBluesky,
  SiDiscogs,
  SiFacebook,
  SiInstagram,
  SiSpotify,
  SiSubstack,
  SiThreads,
} from 'react-icons/si';
import { FiMail, FiLink } from 'react-icons/fi';
import type { IconType } from 'react-icons';

export const SOCIAL_ICON_MAP: Record<string, IconType | ComponentType<{ size?: number }>> = {
  Spotify: SiSpotify,
  Instagram: SiInstagram,
  Facebook: SiFacebook,
  Threads: SiThreads,
  Bluesky: SiBluesky,
  Substack: SiSubstack,
  Discogs: SiDiscogs,
  Email: FiMail,
};

export const getSocialIcon = (name: string) => SOCIAL_ICON_MAP[name] ?? FiLink;
