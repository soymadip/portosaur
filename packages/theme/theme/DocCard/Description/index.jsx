import React from 'react';
import clsx from 'clsx';
import {ThemeClassNames} from '@docusaurus/theme-common';

export default function DocCardDescription({description}) {
  // If we pass a React Node (to make it bold), don't render it as an object tooltip.
  // Look for a custom rawString prop if it's an object, otherwise undefined.
  const titleText = typeof description === 'string' 
    ? description 
    : (description?.props?.['data-raw-string'] || undefined);

  return (
    <p
      className={clsx(
        'text--truncate',
        ThemeClassNames.docs.docCard.description,
        'cardDescription_custom' // to match portosaur's [class*="cardDescription_"] selector
      )}
      style={{ marginBottom: 0 }} // native Docusaurus style
      title={titleText}>
      {description}
    </p>
  );
}
