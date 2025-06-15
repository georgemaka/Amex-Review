import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Stack,
  Chip,
} from '@mui/material';
import { FilterList, Clear } from '@mui/icons-material';
import { RootState } from '../../store';
import api from '../../services/api';
import DateRangeSelector, { DateRange } from './DateRangeSelector';
import { startOfMonth, endOfMonth } from 'date-fns';

interface AnalyticsFiltersProps {
  onFilterChange: (filters: any) => void;
  selectedDate: Date;
  onDateChange: (date: Date | null) => void;
}

const AnalyticsFilters: React.FC<AnalyticsFiltersProps> = ({
  onFilterChange,
  selectedDate,
  onDateChange,
}) => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [cardholders, setCardholders] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [statements, setStatements] = useState<any[]>([]);
  const [selectedCardholder, setSelectedCardholder] = useState<number | ''>('');
  const [selectedCategory, setSelectedCategory] = useState<number | ''>('');
  const [selectedStatement, setSelectedStatement] = useState<number | ''>('');
  
  // Date range state
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonth(selectedDate),
    to: endOfMonth(selectedDate),
    label: 'This Month',
  });

  useEffect(() => {
    loadFilterData();
  }, []);

  const loadFilterData = async () => {
    try {
      const [cardholdersData, categoriesData, statementsData] = await Promise.all([
        api.getCardholders({ is_active: true }),
        api.getSpendingCategories(true),
        api.getStatements(),
      ]);
      setCardholders(cardholdersData);
      setCategories(categoriesData);
      setStatements(statementsData);
    } catch (error) {
      console.error('Failed to load filter data:', error);
    }
  };

  const handleCardholderChange = (value: number | '') => {
    setSelectedCardholder(value);
    onFilterChange({ cardholder_id: value || undefined });
  };

  const handleCategoryChange = (value: number | '') => {
    setSelectedCategory(value);
    onFilterChange({ category_id: value || undefined });
  };

  const handleStatementChange = (value: number | '') => {
    setSelectedStatement(value);
    onFilterChange({ statement_id: value || undefined });
  };

  const handleDateRangeChange = (range: DateRange) => {
    setDateRange(range);
    onFilterChange({
      date_from: range.from.toISOString().split('T')[0],
      date_to: range.to.toISOString().split('T')[0],
    });
    // Also update the legacy selectedDate for backward compatibility
    onDateChange(range.from);
  };

  const handleClearFilters = () => {
    setSelectedCardholder('');
    setSelectedCategory('');
    setSelectedStatement('');
    const now = new Date();
    const defaultRange: DateRange = {
      from: startOfMonth(now),
      to: endOfMonth(now),
      label: 'This Month',
    };
    setDateRange(defaultRange);
    onDateChange(now);
    onFilterChange({
      date_from: defaultRange.from.toISOString().split('T')[0],
      date_to: defaultRange.to.toISOString().split('T')[0],
      cardholder_id: undefined,
      category_id: undefined,
      statement_id: undefined,
    });
  };

  const activeFilters = [];
  if (selectedCardholder) {
    const cardholder = cardholders.find(c => c.id === selectedCardholder);
    if (cardholder) activeFilters.push(`Cardholder: ${cardholder.full_name}`);
  }
  if (selectedCategory) {
    const category = categories.find(c => c.id === selectedCategory);
    if (category) activeFilters.push(`Category: ${category.name}`);
  }
  if (selectedStatement) {
    const statement = statements.find(s => s.id === selectedStatement);
    if (statement) {
      const filename = statement.pdf_filename || statement.excel_filename || `${statement.month}/${statement.year}`;
      const displayName = filename.replace(/\.(pdf|xlsx?)$/i, '');
      activeFilters.push(`Statement: ${displayName}`);
    }
  }

  return (
    <Box sx={{ mb: 3 }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <DateRangeSelector
          value={dateRange}
          onChange={handleDateRangeChange}
        />

        {user?.role === 'admin' && (
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Cardholder</InputLabel>
            <Select
              value={selectedCardholder}
              onChange={(e) => handleCardholderChange(e.target.value as number | '')}
              label="Cardholder"
            >
              <MenuItem value="">All Cardholders</MenuItem>
              {cardholders.map((cardholder) => (
                <MenuItem key={cardholder.id} value={cardholder.id}>
                  {cardholder.full_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Category</InputLabel>
          <Select
            value={selectedCategory}
            onChange={(e) => handleCategoryChange(e.target.value as number | '')}
            label="Category"
          >
            <MenuItem value="">All Categories</MenuItem>
            {categories.map((category) => (
              <MenuItem key={category.id} value={category.id}>
                {category.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Statement</InputLabel>
          <Select
            value={selectedStatement}
            onChange={(e) => handleStatementChange(e.target.value as number | '')}
            label="Statement"
          >
            <MenuItem value="">All Statements</MenuItem>
            {statements.map((statement) => {
              const filename = statement.pdf_filename || statement.excel_filename || `${statement.month}/${statement.year}`;
              const displayName = filename.replace(/\.(pdf|xlsx?)$/i, '');
              return (
                <MenuItem key={statement.id} value={statement.id}>
                  {displayName}
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>

        <Button
          variant="outlined"
          startIcon={<Clear />}
          onClick={handleClearFilters}
          disabled={!selectedCardholder && !selectedCategory && !selectedStatement}
        >
          Clear Filters
        </Button>
      </Stack>

      {activeFilters.length > 0 && (
        <Stack direction="row" spacing={1} alignItems="center">
          <FilterList fontSize="small" color="action" />
          {activeFilters.map((filter, index) => (
            <Chip key={index} label={filter} size="small" variant="outlined" />
          ))}
        </Stack>
      )}
    </Box>
  );
};

export default AnalyticsFilters;