import React from 'react';
// Import the original mapper
import MDXComponents from '@theme-original/MDXComponents';
import MulticodeBlock from '@site/src/theme/multicode-block';
import PlanComparison from '@site/src/components/PlanComparison';

export default {
  // Re-use the default mapping
  ...MDXComponents,
  MulticodeBlock,
  PlanComparison,
};
