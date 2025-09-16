// src/app/admin/media-grading/gradingConfig.ts
export type MediaKind = "vinyl" | "cassette" | "cd";

export type SeverityOption = { v: string; label: string; weight: number };
export type Field = {
  key: string;
  label: string;
  weight?: number; // base weight (for simple on/off)
  severityKey?: string;
  severity?: SeverityOption[]; // if present, overrides base weight
  group?: string; // for UI grouping
  extra?: "skips" | "cd-skips"; // adds sides/tracks UX when relevant
};

export type Section = {
  title: string;
  fields: Field[];
};

export type MediaConfig = {
  mediaTitle: string;
  packagingTitle: string;
  mediaSections: Section[];
  packagingSections: Section[];
};

export const gradeBands = [
  { max: 0,   grade: "M"   }, // Only possible if sealed and no deductions
  { max: 5,   grade: "NM"  },
  { max: 15,  grade: "VG+" },
  { max: 28,  grade: "VG"  },
  { max: 40,  grade: "G+"  },
  { max: 55,  grade: "G"   },
  { max: 999, grade: "P"   },
];

export const configs: Record<MediaKind, MediaConfig> = {
  vinyl: {
    mediaTitle: "🎵 Record Condition Assessment",
    packagingTitle: "📦 Sleeve Condition Assessment",
    mediaSections: [
      {
        title: "Visual Appearance",
        fields: [
          // Base weights approximate Goldmine deductions; severities modeled.
          { key: "vinyl-scuffs", label: "Light scuffs visible", severityKey: "vinyl-scuffs-sev",
            severity: [
              { v:"light",     label:"Very light, barely visible", weight: 5 },
              { v:"moderate",  label:"Visible but not deep",       weight: 9 },
              { v:"heavy",     label:"Obvious, multiple scuffs",   weight: 14 },
            ]},
          { key: "vinyl-scratches", label: "Scratches present", severityKey: "vinyl-scratches-sev",
            severity: [
              { v:"hairline",  label:"Hairline only",              weight: 8  },
              { v:"feelable",  label:"Feelable with fingernail",  weight: 16 },
              { v:"deep",      label:"Deep / groove damage",      weight: 26 },
            ]},
          { key: "vinyl-groove", label: "Groove wear visible", severityKey: "vinyl-groove-sev",
            severity: [
              { v:"slight",    label:"Slight loss of gloss",       weight: 8  },
              { v:"evident",   label:"Evident on sight",           weight: 14 },
              { v:"heavy",     label:"Obvious dulling",            weight: 22 },
            ]},
          { key: "vinyl-warp", label: "Warping present", severityKey: "vinyl-warp-sev",
            severity: [
              { v:"slight",    label:"Slight – does not affect play", weight: 12 },
              { v:"moderate",  label:"May cause tracking",            weight: 22 },
              { v:"severe",    label:"Significantly affects play",    weight: 36 },
            ]},
        ]
      },
      {
        title: "Audio Performance",
        fields: [
          { key: "vinyl-noise", label: "Surface noise when played", severityKey: "vinyl-noise-sev",
            severity: [
              { v:"minimal",   label:"Minimal",     weight: 6  },
              { v:"noticeable",label:"Noticeable",  weight: 12 },
              { v:"significant",label:"Significant",weight: 18 },
            ]},
          { key: "vinyl-pops", label: "Occasional pops or clicks", weight: 6 },
          { key: "vinyl-skips", label: "Skipping or repeating", severityKey: "vinyl-skips-sev", extra: "skips",
            severity: [
              { v:"occasional", label:"Occasional skips", weight: 20 },
              { v:"frequent",   label:"Frequent skipping", weight: 34 },
              { v:"constant",   label:"Constant skipping", weight: 48 },
            ]},
        ]
      },
      {
        title: "Label & Center",
        fields: [
          { key: "vinyl-label-clean", label: "Label is clean and bright", weight: 0 },
          { key: "vinyl-spindle", label: "Spindle marks present", weight: 6 },
          { key: "vinyl-label-writing", label: "Writing on label", weight: 6 },
          { key: "vinyl-label-stickers", label: "Stickers or tape on label", weight: 6 },
        ]
      }
    ],
    packagingSections: [
      {
        title: "Overall Appearance",
        fields: [
          { key: "vinyl-sealed", label: "Sealed (factory shrink intact)", weight: 0 },
          { key: "vinyl-corner", label: "Corner wear present", severityKey: "vinyl-corner-sev",
            severity: [
              { v:"slight",    label:"Slight bumping", weight: 4 },
              { v:"creased",   label:"Creased/frayed", weight: 9 },
              { v:"cut",       label:"Corner cut",     weight: 14 },
            ]},
          { key: "vinyl-ring", label: "Ring wear visible", severityKey: "vinyl-ring-sev",
            severity: [
              { v:"light",     label:"Light",    weight: 6  },
              { v:"evident",   label:"Evident",  weight: 12 },
              { v:"heavy",     label:"Heavy",    weight: 18 },
            ]},
        ]
      },
      {
        title: "Seams & Structure",
        fields: [
          { key: "vinyl-seams", label: "Seam splits present", severityKey: "vinyl-seams-sev",
            severity: [
              { v:"small",     label:"Small",  weight: 8  },
              { v:"medium",    label:"Medium", weight: 14 },
              { v:"large",     label:"Large",  weight: 22 },
            ]},
          { key: "vinyl-spine", label: "Spine shows wear", weight: 6 },
        ]
      },
      {
        title: "Damage & Markings",
        fields: [
          { key: "vinyl-tears", label: "Tears present", severityKey: "vinyl-tears-sev",
            severity: [
              { v:"small",     label:"Small",       weight: 8  },
              { v:"significant",label:"Significant",weight: 16 },
              { v:"major",     label:"Major",       weight: 26 },
            ]},
          { key: "vinyl-writing", label: "Writing present", severityKey: "vinyl-writing-sev",
            severity: [
              { v:"small",     label:"Small",       weight: 6  },
              { v:"noticeable",label:"Noticeable",  weight: 10 },
              { v:"heavy",     label:"Heavy",       weight: 16 },
            ]},
          { key: "vinyl-stickers", label: "Stickers or tape", severityKey: "vinyl-stickers-sev",
            severity: [
              { v:"residue",   label:"Residue",        weight: 4  },
              { v:"partial",   label:"Partial removal",weight: 8  },
              { v:"heavy",     label:"Heavy",          weight: 12 },
            ]},
        ]
      }
    ]
  },

  cassette: {
    mediaTitle: "📼 Tape Condition Assessment",
    packagingTitle: "📦 Case & J-Card Assessment",
    mediaSections: [
      {
        title: "Tape & Shell",
        fields: [
          { key: "tape-shell-crack", label: "Shell crack present", severityKey: "tape-shell-crack-sev",
            severity: [
              { v:"hairline",  label:"Hairline / cosmetic", weight: 6 },
              { v:"major",     label:"Major / structural",  weight: 14},
            ]},
          { key: "tape-pressure-pad-missing", label: "Pressure pad missing", weight: 16 },
          { key: "tape-pack-warp", label: "Irregular tape pack / warping", severityKey: "tape-pack-warp-sev",
            severity: [
              { v:"mild",      label:"Mild",      weight: 8  },
              { v:"moderate",  label:"Moderate",  weight: 14 },
              { v:"severe",    label:"Severe",    weight: 22 },
            ]},
        ]
      },
      {
        title: "Playback",
        fields: [
          { key: "tape-dropouts-hiss", label: "Dropouts / hiss present", severityKey: "tape-dropouts-hiss-sev",
            severity: [
              { v:"minimal",   label:"Minimal",   weight: 6  },
              { v:"noticeable",label:"Noticeable",weight: 12 },
              { v:"severe",    label:"Severe",    weight: 18 },
            ]},
          { key: "tape-wow-flutter", label: "Wow / flutter", severityKey: "tape-wow-flutter-sev",
            severity: [
              { v:"mild",      label:"Mild",      weight: 6  },
              { v:"moderate",  label:"Moderate",  weight: 12 },
              { v:"severe",    label:"Severe",    weight: 18 },
            ]},
          { key: "tape-squeal-stick", label: "Squeal / sticking", severityKey: "tape-squeal-stick-sev",
            severity: [
              { v:"occasional", label:"Occasional", weight: 12 },
              { v:"frequent",   label:"Frequent",   weight: 20 },
              { v:"constant",   label:"Constant",   weight: 30 },
            ]},
          { key: "tape-stretch-wrinkle", label: "Tape stretch / wrinkles", severityKey: "tape-stretch-wrinkle-sev",
            severity: [
              { v:"mild",      label:"Mild",      weight: 12 },
              { v:"moderate",  label:"Moderate",  weight: 20 },
              { v:"severe",    label:"Severe",    weight: 30 },
            ]},
          { key: "tape-channel-dropout", label: "Channel(s) drop out", severityKey: "tape-channel-dropout-sev",
            severity: [
              { v:"intermittent", label:"Intermittent", weight: 12 },
              { v:"frequent",     label:"Frequent",     weight: 22 },
              { v:"constant",     label:"Constant",     weight: 32 },
            ]},
        ]
      }
    ],
    packagingSections: [
      {
        title: "Case & J-Card",
        fields: [
          { key: "cassette-sealed", label: "Sealed (factory shrink intact)", weight: 0 },
          { key: "cassette-case-crack", label: "Case crack", severityKey: "cassette-case-crack-sev",
            severity: [
              { v:"hairline",  label:"Hairline", weight: 4 },
              { v:"major",     label:"Major",    weight: 10},
            ]},
          { key: "cassette-hinge-broken", label: "Hinge broken", weight: 10 },
          { key: "cassette-jcard-tears", label: "J-card tears / creases", severityKey: "cassette-jcard-tears-sev",
            severity: [
              { v:"small",     label:"Small",  weight: 6  },
              { v:"medium",    label:"Medium", weight: 12 },
              { v:"large",     label:"Large",  weight: 18 },
            ]},
          { key: "cassette-water-damage", label: "Water damage / staining", severityKey: "cassette-water-damage-sev",
            severity: [
              { v:"light",     label:"Light",     weight: 8  },
              { v:"moderate",  label:"Moderate",  weight: 16 },
              { v:"severe",    label:"Severe",    weight: 26 },
            ]},
          { key: "cassette-writing-stickers", label: "Writing / stickers", severityKey: "cassette-writing-stickers-sev",
            severity: [
              { v:"small",     label:"Small",       weight: 4  },
              { v:"noticeable",label:"Noticeable",  weight: 8  },
              { v:"heavy",     label:"Heavy",       weight: 12 },
            ]},
        ]
      }
    ]
  },

  cd: {
    mediaTitle: "💿 Disc Condition Assessment",
    packagingTitle: "📦 Packaging Assessment",
    mediaSections: [
      {
        title: "Disc Condition",
        fields: [
          { key: "cd-scuffs", label: "Light scuffs visible", weight: 4 },
          { key: "cd-scratches", label: "Scratches present", severityKey: "cd-scratches-sev",
            severity: [
              { v:"hairline",  label:"Hairline", weight: 8  },
              { v:"feelable",  label:"Feelable", weight: 18 },
              { v:"deep",      label:"Deep",     weight: 28 },
            ]},
          { key: "cd-label-scratch", label: "Label-side scratch (top coat) present", weight: 26 },
          { key: "cd-hub-crack", label: "Hub crack present", severityKey: "cd-hub-crack-sev",
            severity: [
              { v:"hairline",  label:"Hairline", weight: 8  },
              { v:"spider",    label:"Spidering",weight: 14 },
              { v:"through",   label:"Through hub", weight: 24 },
            ]},
          { key: "cd-pinholes", label: "Pinholes visible", severityKey: "cd-pinholes-sev",
            severity: [
              { v:"few",       label:"Few",  weight: 4 },
              { v:"many",      label:"Many", weight: 10},
            ]},
          { key: "cd-bronzing-rot", label: "Bronzing / disc rot", severityKey: "cd-bronzing-rot-sev",
            severity: [
              { v:"early",     label:"Early",     weight: 16 },
              { v:"moderate",  label:"Moderate",  weight: 28 },
              { v:"severe",    label:"Severe",    weight: 40 },
            ]},
          { key: "cd-skips", label: "Skips or read errors", severityKey: "cd-skips-sev", extra: "cd-skips",
            severity: [
              { v:"occasional", label:"Occasional", weight: 18 },
              { v:"frequent",   label:"Frequent",   weight: 30 },
              { v:"constant",   label:"Constant",   weight: 44 },
            ]},
        ]
      }
    ],
    packagingSections: [
      {
        title: "Jewel/Booklet",
        fields: [
          { key: "cd-sealed", label: "Sealed (factory wrap intact)", weight: 0 },
          { key: "cd-jewel-cracked", label: "Jewel case cracked", severityKey: "cd-jewel-cracked-sev",
            severity: [
              { v:"hairline",  label:"Hairline", weight: 4 },
              { v:"major",     label:"Major",    weight: 10},
            ]},
          { key: "cd-hub-broken", label: "Center hub broken", weight: 12 },
          { key: "cd-booklet-wear", label: "Booklet wear", severityKey: "cd-booklet-wear-sev",
            severity: [
              { v:"light",     label:"Light", weight: 4 },
              { v:"evident",   label:"Evident", weight: 8 },
              { v:"heavy",     label:"Heavy", weight: 12 },
            ]},
          { key: "cd-booklet-tear", label: "Booklet tears", severityKey: "cd-booklet-tear-sev",
            severity: [
              { v:"small",     label:"Small", weight: 6 },
              { v:"significant", label:"Significant", weight: 12 },
              { v:"major",     label:"Major", weight: 18 },
            ]},
          { key: "cd-water-damage", label: "Water damage", severityKey: "cd-water-damage-sev",
            severity: [
              { v:"light",     label:"Light", weight: 8 },
              { v:"moderate",  label:"Moderate", weight: 16 },
              { v:"severe",    label:"Severe", weight: 26 },
            ]},
          { key: "cd-stickers-residue", label: "Stickers / residue", severityKey: "cd-stickers-residue-sev",
            severity: [
              { v:"small",     label:"Small", weight: 4 },
              { v:"noticeable",label:"Noticeable", weight: 8 },
              { v:"heavy",     label:"Heavy", weight: 12 },
            ]},
        ]
      }
    ]
  }
};
