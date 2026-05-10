/**
 * Catppuccin theme for Prism.js
**/

// Catppuccin Mocha (dark theme)
export const catppuccinMocha = {
  plain: {
    color: '#cdd6f4',
    backgroundColor: '#181825',
  },
  styles: [
    {
      types: ['comment', 'prolog', 'doctype', 'cdata'],
      style: {
        color: '#6c7086',
        fontStyle: 'italic',
      },
    },
    {
      types: ['namespace'],
      style: {
        opacity: 0.7,
      },
    },
    {
      types: ['string', 'char', 'attr-value'],
      style: {
        color: '#a6e3a1',
      },
    },
    {
      types: ['punctuation', 'operator'],
      style: {
        color: '#a6adc8',
      },
    },
    {
      types: [
        'entity',
        'url',
        'symbol',
        'number',
        'boolean',
        'variable',
        'constant',
        'property',
        'regex',
        'inserted',
      ],
      style: {
        color: '#fab387',
      },
    },
    {
      types: ['atrule', 'keyword', 'attr-name', 'selector'],
      style: {
        color: '#cba6f7',
      },
    },
    {
      types: ['function', 'deleted', 'tag'],
      style: {
        color: '#f38ba8',
      },
    },
    {
      types: ['function-variable'],
      style: {
        color: '#89b4fa',
      },
    },
    {
      types: ['class-name'],
      style: {
        color: '#f9e2af',
      },
    },
    {
      types: ['important', 'bold'],
      style: {
        fontWeight: 'bold',
      },
    },
    {
      types: ['italic'],
      style: {
        fontStyle: 'italic',
      },
    },
  ],
};

// Catppuccin Latte (light theme)
export const catppuccinLatte = {
  plain: {
    color: '#4c4f69',
    backgroundColor: '#FAF9F6',
  },
  styles: [
    {
      types: ['comment', 'prolog', 'doctype', 'cdata'],
      style: {
        color: '#8c8fa1',
        fontStyle: 'italic',
      },
    },
    {
      types: ['namespace'],
      style: {
        opacity: 0.7,
      },
    },
    {
      types: ['string', 'char', 'attr-value'],
      style: {
        color: '#40a02b',
      },
    },
    {
      types: ['punctuation', 'operator'],
      style: {
        color: '#8c8fa1',
      },
    },
    {
      types: [
        'entity',
        'url',
        'symbol',
        'number',
        'boolean',
        'variable',
        'constant',
        'property',
        'regex',
        'inserted',
      ],
      style: {
        color: '#fe640b',
      },
    },
    {
      types: ['atrule', 'keyword', 'attr-name', 'selector'],
      style: {
        color: '#8839ef',
      },
    },
    {
      types: ['function', 'deleted', 'tag'],
      style: {
        color: '#d20f39',
      },
    },
    {
      types: ['function-variable'],
      style: {
        color: '#1e66f5',
      },
    },
    {
      types: ['class-name'],
      style: {
        color: '#df8e1d',
      },
    },
    {
      types: ['important', 'bold'],
      style: {
        fontWeight: 'bold',
      },
    },
    {
      types: ['italic'],
      style: {
        fontStyle: 'italic',
      },
    },
  ],
};
