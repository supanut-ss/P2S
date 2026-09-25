import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import { styled } from '@mui/material/styles';

const ImageContainer = styled(Box)(({ theme }) => ({
  width: 44,
  height: 44,
  minWidth: 44,
  borderRadius: 8,
  overflow: 'hidden',
  backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(20, 28, 28, 0.04)',
  border: `1px solid ${theme.palette.divider}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));

const ProductImg = styled('img')({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
});

export interface DataGridProductCellProps {
  name: string;
  sku?: string;
  image?: string;
  subtitle?: string;
}

export const DataGridProductCell: React.FC<DataGridProductCellProps> = ({
  name,
  sku,
  image,
  subtitle,
}) => {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, py: 0.5 }}>
      <ImageContainer>
        {image ? (
          <ProductImg src={image} alt={name} loading="lazy" />
        ) : (
          <Inventory2OutlinedIcon sx={{ fontSize: '1.25rem', color: 'text.secondary', opacity: 0.7 }} />
        )}
      </ImageContainer>
      <Box sx={{ minWidth: 0, overflow: 'hidden' }}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={name}
        >
          {name}
        </Typography>
        {(sku || subtitle) && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: 'block',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {sku && `SKU: ${sku}`}
            {sku && subtitle && ' · '}
            {subtitle}
          </Typography>
        )}
      </Box>
    </Box>
  );
};
