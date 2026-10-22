import { definePreset } from '@primeng/themes';
import Aura from '@primeng/themes/aura';

/** Aura customised with FieldPulse's indigo-violet primary and violet-tinted neutrals. */
export const FieldPulsePreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#f3f1ff',
      100: '#e9e5ff',
      200: '#d5cdff',
      300: '#b7a6ff',
      400: '#9575ff',
      500: '#6d4aff',
      600: '#5b34f0',
      700: '#4c27cc',
      800: '#3f22a5',
      900: '#351f82',
      950: '#1f114f',
    },
    colorScheme: {
      light: {
        surface: {
          0: '#ffffff', 50: '#f8f8fc', 100: '#f0f0f8', 200: '#e4e4f0', 300: '#cfcfe0', 400: '#a3a2bd',
          500: '#7a7996', 600: '#5c5b78', 700: '#46455f', 800: '#2f2e45', 900: '#1f1e33', 950: '#13121f',
        },
      },
      dark: {
        surface: {
          0: '#ffffff', 50: '#e8e7f5', 100: '#cfcde6', 200: '#aeabcf', 300: '#8d8ab3', 400: '#6c6993',
          500: '#504d76', 600: '#3a385b', 700: '#2a2947', 800: '#1c1b35', 900: '#15142a', 950: '#0d0c1a',
        },
        primary: {
          color: '{primary.400}',
          contrastColor: '{surface.950}',
          hoverColor: '{primary.300}',
          activeColor: '{primary.200}',
        },
      },
    },
  },
});
