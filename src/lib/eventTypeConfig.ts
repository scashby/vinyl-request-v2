export type EventSubtypeDefaults = {
  time?: string;
  location?: string;
  image_url?: string;
  has_queue?: boolean;
  queue_types?: string[];
  is_recurring?: boolean;
  recurrence_pattern?: string;
  recurrence_interval?: number;
};

export type EventSubtypeConfig = {
  id: string;
  label: string;
  defaults?: EventSubtypeDefaults;
};

export type EventTypeConfig = {
  id: string;
  label: string;
  description?: string;
  subtypes?: EventSubtypeConfig[];
};

export type EventTypeConfigState = {
  types: EventTypeConfig[];
};

export const defaultEventTypeConfig: EventTypeConfigState = {
  types: [
    {
      id: 'brewery',
      label: 'Brewery Event',
      description: "Hosted at Devil's Purse Brewing Company.",
      subtypes: [
        { id: 'live-jukebox', label: 'Live Jukebox' },
        {
          id: 'vinyl-sundays',
          label: 'Vinyl Sundays',
          defaults: {
            time: '12:00 PM - 6:00 PM',
            location: "Devil's Purse Brewing Company",
            has_queue: true,
            queue_types: ['side', 'track'],
            is_recurring: true,
            recurrence_pattern: 'weekly',
            recurrence_interval: 1,
          },
        },
        { id: 'vinyl-trivia', label: 'Vinyl Trivia' },
        { id: 'vinyl-bingo', label: 'Vinyl Music Bingo' },
      ],
    },
    {
      id: 'public-dj',
      label: 'Public DJ Event',
      description: 'Off-site DJ events with public details.',
    },
    {
      id: 'private-dj',
      label: 'Private DJ Event',
      description: 'Displays publicly as “Private Event.”',
    },
    {
      id: 'other',
      label: 'Other Event',
      description: 'General appearances or non-DJ events.',
    },
  ],
};
