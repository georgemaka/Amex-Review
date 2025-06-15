import React, { useState, useEffect } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  TextField,
  Typography,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, subMonths, startOfYear, subYears, startOfMonth, endOfMonth } from 'date-fns';

export interface DateRange {
  from: Date;
  to: Date;
  label: string;
}

interface DateRangeSelectorProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({ value, onChange }) => {
  const [selectedPreset, setSelectedPreset] = useState<string>('this_month');
  const [customFrom, setCustomFrom] = useState<Date | null>(null);
  const [customTo, setCustomTo] = useState<Date | null>(null);

  // Preset date ranges
  const getPresetRanges = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return {
      this_month: {
        from: startOfMonth(now),
        to: endOfMonth(now),
        label: 'This Month',
      },
      last_month: {
        from: startOfMonth(subMonths(now, 1)),
        to: endOfMonth(subMonths(now, 1)),
        label: 'Last Month',
      },
      last_3_months: {
        from: startOfMonth(subMonths(now, 2)),
        to: endOfMonth(now),
        label: 'Last 3 Months',
      },
      last_6_months: {
        from: startOfMonth(subMonths(now, 5)),
        to: endOfMonth(now),
        label: 'Last 6 Months',
      },
      year_to_date: {
        from: startOfYear(now),
        to: endOfMonth(now),
        label: 'Year to Date',
      },
      last_year: {
        from: startOfYear(subYears(now, 1)),
        to: new Date(currentYear - 1, 11, 31),
        label: 'Last Year',
      },
      all_time: {
        from: new Date(2020, 0, 1), // Adjust based on your data
        to: endOfMonth(now),
        label: 'All Time',
      },
      custom: {
        from: customFrom || startOfMonth(now),
        to: customTo || endOfMonth(now),
        label: 'Custom Range',
      },
    };
  };

  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset);
    
    if (preset !== 'custom') {
      const ranges = getPresetRanges();
      const range = ranges[preset as keyof typeof ranges];
      onChange(range);
    }
  };

  const handleCustomDateChange = (type: 'from' | 'to', date: Date | null) => {
    if (!date) return;

    if (type === 'from') {
      setCustomFrom(date);
      if (customTo) {
        onChange({
          from: date,
          to: customTo,
          label: `${format(date, 'MMM d, yyyy')} - ${format(customTo, 'MMM d, yyyy')}`,
        });
      }
    } else {
      setCustomTo(date);
      if (customFrom) {
        onChange({
          from: customFrom,
          to: date,
          label: `${format(customFrom, 'MMM d, yyyy')} - ${format(date, 'MMM d, yyyy')}`,
        });
      }
    }
  };

  // Format the current date range for display
  const formatDateRange = () => {
    if (value.from && value.to) {
      const fromStr = format(value.from, 'MMM d, yyyy');
      const toStr = format(value.to, 'MMM d, yyyy');
      
      // If same month and year, show compressed format
      if (value.from.getMonth() === value.to.getMonth() && 
          value.from.getFullYear() === value.to.getFullYear()) {
        return format(value.from, 'MMMM yyyy');
      }
      
      return `${fromStr} - ${toStr}`;
    }
    return '';
  };

  return (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      <FormControl size="small" sx={{ minWidth: 200 }}>
        <InputLabel>Date Range</InputLabel>
        <Select
          value={selectedPreset}
          onChange={(e) => handlePresetChange(e.target.value)}
          label="Date Range"
        >
          <MenuItem value="this_month">This Month</MenuItem>
          <MenuItem value="last_month">Last Month</MenuItem>
          <MenuItem value="last_3_months">Last 3 Months</MenuItem>
          <MenuItem value="last_6_months">Last 6 Months</MenuItem>
          <MenuItem value="year_to_date">Year to Date</MenuItem>
          <MenuItem value="last_year">Last Year</MenuItem>
          <MenuItem value="all_time">All Time</MenuItem>
          <MenuItem value="custom">Custom Range</MenuItem>
        </Select>
      </FormControl>

      {selectedPreset === 'custom' && (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DatePicker
            label="From"
            value={customFrom}
            onChange={(date) => handleCustomDateChange('from', date)}
            slotProps={{
              textField: { size: 'small', sx: { width: 150 } },
            }}
          />
          <DatePicker
            label="To"
            value={customTo}
            onChange={(date) => handleCustomDateChange('to', date)}
            slotProps={{
              textField: { size: 'small', sx: { width: 150 } },
            }}
          />
        </LocalizationProvider>
      )}

      {selectedPreset !== 'custom' && (
        <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
          {formatDateRange()}
        </Typography>
      )}
    </Box>
  );
};

export default DateRangeSelector;