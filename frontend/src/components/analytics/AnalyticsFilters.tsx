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
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { FilterList, Clear } from '@mui/icons-material';
import { RootState } from '../../store';
import api from '../../services/api';

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
  const [selectedCardholder, setSelectedCardholder] = useState<number | ''>('');
  const [selectedCategory, setSelectedCategory] = useState<number | ''>('');

  useEffect(() => {
    loadFilterData();
  }, []);

  const loadFilterData = async () => {
    try {
      const [cardholdersData, categoriesData] = await Promise.all([
        api.getCardholders({ is_active: true }),
        api.getSpendingCategories(true),
      ]);
      setCardholders(cardholdersData);
      setCategories(categoriesData);
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

  const handleClearFilters = () => {
    setSelectedCardholder('');
    setSelectedCategory('');
    const now = new Date();
    onDateChange(now);
    onFilterChange({
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      cardholder_id: undefined,
      category_id: undefined,
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

  return (
    <Box sx={{ mb: 3 }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DatePicker
            label="Month"
            value={selectedDate}
            onChange={onDateChange}
            views={['year', 'month']}
            slotProps={{
              textField: {
                size: 'small',
                sx: { minWidth: 200 },
              },
            }}
          />
        </LocalizationProvider>

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

        <Button
          variant="outlined"
          startIcon={<Clear />}
          onClick={handleClearFilters}
          disabled={!selectedCardholder && !selectedCategory}
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