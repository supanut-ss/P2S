import React from 'react';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

export const CustomExpandIcon = React.forwardRef<SVGSVGElement, React.ComponentProps<typeof ExpandMoreIcon>>(
  (props, ref) => <ExpandMoreIcon ref={ref} {...props} />,
);
CustomExpandIcon.displayName = 'CustomExpandIcon';

export const CustomCollapseIcon = React.forwardRef<SVGSVGElement, React.ComponentProps<typeof ExpandMoreIcon>>(
  (props, ref) => (
    <ExpandMoreIcon
      ref={ref}
      {...props}
      sx={{
        transform: 'rotateZ(180deg)',
        transition: 'transform 0.2s ease-in-out',
        ...(props.sx || {}),
      }}
    />
  ),
);
CustomCollapseIcon.displayName = 'CustomCollapseIcon';
