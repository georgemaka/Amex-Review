import os
import csv
from typing import Dict, List, Optional
from datetime import datetime
import openpyxl
import pandas as pd
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


class ExcelProcessor:
    def __init__(self):
        self.vendor_code = settings.AMEX_VENDOR_CODE
        self.starting_row = 15  # Data starts at row 15
        self.jcco = "1"  # Job Cost Company
        self.record_type = "3"  # Type for APLB records
    
    def parse_statement(self, excel_path: str) -> Dict[str, List[Dict]]:
        """
        Parse AMEX Excel statement and group transactions by cardholder.
        Returns dict with cardholder names as keys and transaction lists as values.
        """
        transactions_by_cardholder = {}
        
        try:
            # Load Excel file
            wb = openpyxl.load_workbook(excel_path, data_only=True)
            sheet = wb.active
            
            # Process rows starting from row 15
            for row_num in range(self.starting_row, sheet.max_row + 1):
                # Extract data from columns
                first_name = self._clean_value(sheet.cell(row=row_num, column=1).value)
                last_name = self._clean_value(sheet.cell(row=row_num, column=2).value)
                
                if not first_name or not last_name:
                    continue
                
                # Build cardholder name
                cardholder_name = f"{first_name} {last_name}".upper()
                
                # Extract transaction data
                transaction = {
                    "first_name": first_name.upper(),
                    "last_name": last_name.upper(),
                    "amount": self._clean_amount(sheet.cell(row=row_num, column=7).value),
                    "transaction_date": self._clean_date(sheet.cell(row=row_num, column=3).value),
                    "posting_date": self._clean_date(sheet.cell(row=row_num, column=4).value),
                    "description": self._clean_value(sheet.cell(row=row_num, column=5).value),
                    "merchant": self._clean_value(sheet.cell(row=row_num, column=6).value),
                    "row_number": row_num
                }
                
                # Group by cardholder
                if cardholder_name not in transactions_by_cardholder:
                    transactions_by_cardholder[cardholder_name] = []
                
                transactions_by_cardholder[cardholder_name].append(transaction)
            
            wb.close()
            
        except Exception as e:
            logger.error(f"Error parsing Excel file: {str(e)}")
            raise
        
        return transactions_by_cardholder
    
    def generate_csv_files(self, transactions_by_cardholder: Dict[str, List[Dict]], 
                          output_dir: str, statement_month: int, statement_year: int) -> Dict[str, str]:
        """
        Generate CSV files for each cardholder in Vista import format.
        Returns dict with cardholder names as keys and file paths as values.
        """
        os.makedirs(output_dir, exist_ok=True)
        file_paths = {}
        
        for cardholder_name, transactions in transactions_by_cardholder.items():
            if not transactions:
                continue
            
            # Generate filename
            filename = f"{cardholder_name}.csv"
            filepath = os.path.join(output_dir, filename)
            
            # Calculate total amount
            total_amount = sum(t["amount"] for t in transactions)
            
            # Generate AP reference
            ap_reference = self._generate_ap_reference(
                transactions[0]["first_name"],
                transactions[0]["last_name"],
                statement_month
            )
            
            # Write CSV file
            with open(filepath, 'w', newline='', encoding='utf-8') as csvfile:
                writer = csv.writer(csvfile)
                
                # Write APHB header record
                header_row = [
                    "APHB",
                    self.vendor_code,
                    f"{total_amount:.2f}",
                    ap_reference,
                    "",  # Empty columns
                    "",
                    "",
                    "",
                    "",
                    ""
                ]
                writer.writerow(header_row)
                
                # Write APLB line records
                for idx, transaction in enumerate(transactions, 1):
                    line_row = [
                        "APLB",
                        self.record_type,
                        f"{transaction['amount']:.2f}",
                        "",  # GL Account (to be coded)
                        "",  # Empty
                        self.jcco,
                        "",  # Job (to be coded)
                        "",  # Phase (to be coded)
                        "",  # Cost Type (to be coded)
                        f"{transaction['description']} - {transaction['merchant']}"
                    ]
                    writer.writerow(line_row)
            
            file_paths[cardholder_name] = filepath
            logger.info(f"Generated CSV for {cardholder_name}: {filename}")
        
        return file_paths
    
    def generate_coding_template(self, transactions: List[Dict], output_path: str) -> None:
        """Generate a coding template CSV with transaction details."""
        with open(output_path, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = [
                'Transaction Date', 'Posting Date', 'Description', 'Merchant', 
                'Amount', 'GL Account', 'Job Code', 'Phase', 'Cost Type', 'Notes'
            ]
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            
            for transaction in transactions:
                writer.writerow({
                    'Transaction Date': transaction['transaction_date'],
                    'Posting Date': transaction['posting_date'],
                    'Description': transaction['description'],
                    'Merchant': transaction['merchant'],
                    'Amount': transaction['amount'],
                    'GL Account': '',  # To be filled by coder
                    'Job Code': '',    # To be filled by coder
                    'Phase': '',       # To be filled by coder
                    'Cost Type': '',   # To be filled by coder
                    'Notes': ''        # To be filled by coder
                })
    
    def _clean_value(self, value):
        """Clean and standardize cell values."""
        if value is None:
            return ""
        return str(value).strip()
    
    def _clean_amount(self, value):
        """Clean and convert amount values."""
        if value is None:
            return 0.0
        if isinstance(value, (int, float)):
            return float(value)
        # Handle string amounts with commas
        return float(str(value).replace(',', '').replace('$', ''))
    
    def _clean_date(self, value):
        """Clean and format date values."""
        if value is None:
            return None
        if isinstance(value, datetime):
            return value
        # Try to parse string dates
        try:
            return datetime.strptime(str(value), "%m/%d/%Y")
        except:
            return None
    
    def _generate_ap_reference(self, first_name: str, last_name: str, month: int) -> str:
        """Generate AP reference in format: amex{month}{initials}"""
        month_str = str(month).zfill(2)
        initials = f"{first_name[0]}{last_name[0]}".upper()
        return f"amex{month_str}{initials}"