'use client';

import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';

export default function TooltipProvider() {
  return <Tooltip id="app-tooltip" place="bottom" variant="dark" />;
}
