/**
 * RAW colour palette — layer 1 of 3.
 *
 * **Never referenced by a component.** Components bind to the SEMANTIC layer
 * (`theme/semantic/`), which maps these to meaning. That indirection is what
 * makes dark mode a swap of one file and a palette change a no-op for every
 * screen (CLAUDE.md §18).
 *
 * If you find yourself importing this file outside `theme/`, the semantic layer
 * is missing a token — add it there instead.
 */
export const palette = {
  // Neutrals — the backbone of both themes.
  white: '#FFFFFF',
  black: '#000000',

  grey0: '#FAFBFC',
  grey50: '#F2F4F7',
  grey100: '#E4E7EC',
  grey200: '#D0D5DD',
  grey300: '#98A2B3',
  grey400: '#667085',
  grey500: '#475467',
  grey600: '#344054',
  grey700: '#1D2939',
  grey800: '#101828',
  grey900: '#0A0F1A',
  grey950: '#05080F',

  // Primary — sky blue. The app's identity colour.
  blue50: '#EFF8FF',
  blue100: '#D1E9FF',
  blue200: '#B2DDFF',
  blue300: '#84CAFF',
  blue400: '#53B1FD',
  blue500: '#2E90FA',
  blue600: '#1570EF',
  blue700: '#175CD3',
  blue800: '#1849A9',
  blue900: '#194185',

  // Warm — sunrise, sunset, heat, UV.
  amber100: '#FEF0C7',
  amber300: '#FEC84B',
  amber400: '#FDB022',
  amber500: '#F79009',
  amber600: '#DC6803',
  amber700: '#B54708',

  orange400: '#FF8A4C',
  orange500: '#FF6B35',

  // Alert — severe weather, extreme heat, hazardous air.
  red100: '#FEE4E2',
  red300: '#FDA29B',
  red400: '#F97066',
  red500: '#F04438',
  red600: '#D92D20',
  red700: '#B42318',

  // Good — safe AQI, mild conditions.
  green100: '#D1FADF',
  green300: '#6CE9A6',
  green400: '#32D583',
  green500: '#12B76A',
  green600: '#039855',
  green700: '#027A48',

  // Cool — cold, snow, night sky.
  indigo300: '#A4BCFD',
  indigo400: '#8098F9',
  indigo500: '#6172F3',
  indigo700: '#3538CD',
  indigo900: '#2D3282',

  purple400: '#9B8AFB',
  purple500: '#7A5AF8',
  purple900: '#3E1C96',

  teal300: '#5FE9D0',
  teal500: '#15B79E',

  // Sky gradients — used only by `theme/weather/`, never directly.
  skyDawn: '#F9C784',
  skyDay: '#4EA8DE',
  skyDusk: '#E8794A',
  skyNight: '#0B1026',
  skyOvercast: '#8A94A6',
  skyStorm: '#3D4454',
} as const;

export type PaletteColor = keyof typeof palette;
