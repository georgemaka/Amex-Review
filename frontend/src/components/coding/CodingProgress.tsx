import React from 'react';
import { Box, Typography, LinearProgress, Chip } from '@mui/material';

interface CodingProgressProps {
  total: number;
  coded: number;
  reviewed: number;
  rejected: number;
}

const CodingProgress: React.FC<CodingProgressProps> = ({
  total,
  coded,
  reviewed,
  rejected,
}) => {
  const progress = total > 0 ? ((coded + reviewed) / total) * 100 : 0;
  const uncoded = total - coded - reviewed - rejected;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Box sx={{ width: '100%', mr: 1 }}>
          <LinearProgress 
            variant="determinate" 
            value={progress} 
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>
        <Box sx={{ minWidth: 35 }}>
          <Typography variant="body2" color="text.secondary">
            {`${Math.round(progress)}%`}
          </Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Chip
          size="small"
          label={`Uncoded: ${uncoded}`}
          color="default"
        />
        <Chip
          size="small"
          label={`Coded: ${coded}`}
          color="primary"
        />
        <Chip
          size="small"
          label={`Reviewed: ${reviewed}`}
          color="success"
        />
        {rejected > 0 && (
          <Chip
            size="small"
            label={`Rejected: ${rejected}`}
            color="error"
          />
        )}
      </Box>
    </Box>
  );
};

export default CodingProgress;