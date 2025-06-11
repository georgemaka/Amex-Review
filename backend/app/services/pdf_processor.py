import os
import re
from typing import Dict, List, Tuple, Optional
from datetime import datetime
import pdfplumber
from PyPDF2 import PdfReader, PdfWriter
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


class PDFProcessor:
    def __init__(self):
        self.cardholder_pattern = re.compile(r"Total for (.+?)\s+\$[\d,]+\.\d{2}")
        self.closing_date_pattern = re.compile(r"Closing Date:\s*(\d{2}/\d{2}/\d{4})")
        self.skip_names = ["J BEHRENS FIELD 2"]
    
    def split_by_cardholder(self, pdf_path: str, output_dir: str) -> Dict[str, Dict]:
        """
        Split master PDF into individual cardholder PDFs.
        Returns dict with cardholder info and file paths.
        """
        results = {}
        closing_date = None
        
        try:
            # Extract text and find cardholder sections
            with pdfplumber.open(pdf_path) as pdf:
                # Find closing date first
                for page in pdf.pages[:5]:  # Check first 5 pages
                    text = page.extract_text() or ""
                    date_match = self.closing_date_pattern.search(text)
                    if date_match:
                        date_str = date_match.group(1)
                        closing_date = datetime.strptime(date_str, "%m/%d/%Y")
                        break
                
                # Find all cardholder sections
                cardholder_pages = self._find_cardholder_sections(pdf)
            
            # Create output directory if it doesn't exist
            os.makedirs(output_dir, exist_ok=True)
            
            # Split PDF
            reader = PdfReader(pdf_path)
            
            for cardholder_name, page_range in cardholder_pages.items():
                if cardholder_name in self.skip_names:
                    continue
                
                writer = PdfWriter()
                for page_num in range(page_range[0] - 1, page_range[1]):
                    writer.add_page(reader.pages[page_num])
                
                # Generate filename
                filename = self._generate_filename(cardholder_name, closing_date)
                output_path = os.path.join(output_dir, filename)
                
                # Write PDF
                with open(output_path, "wb") as output_file:
                    writer.write(output_file)
                
                results[cardholder_name] = {
                    "filename": filename,
                    "path": output_path,
                    "page_start": page_range[0],
                    "page_end": page_range[1],
                    "closing_date": closing_date
                }
                
                logger.info(f"Created PDF for {cardholder_name}: {filename}")
        
        except Exception as e:
            logger.error(f"Error processing PDF: {str(e)}")
            raise
        
        return results
    
    def _find_cardholder_sections(self, pdf) -> Dict[str, Tuple[int, int]]:
        """Find page ranges for each cardholder."""
        cardholder_pages = {}
        current_cardholder = None
        start_page = None
        
        for page_num, page in enumerate(pdf.pages, 1):
            text = page.extract_text() or ""
            
            # Skip blank pages
            if len(text.strip()) < 50:
                continue
            
            # Look for cardholder totals
            matches = self.cardholder_pattern.findall(text)
            
            if matches:
                # If we were tracking a cardholder, save their page range
                if current_cardholder and start_page:
                    cardholder_pages[current_cardholder] = (start_page, page_num)
                
                # Start tracking new cardholder
                current_cardholder = matches[0].strip()
                start_page = page_num
        
        # Save the last cardholder
        if current_cardholder and start_page:
            cardholder_pages[current_cardholder] = (start_page, len(pdf.pages))
        
        return cardholder_pages
    
    def _generate_filename(self, cardholder_name: str, closing_date: Optional[datetime]) -> str:
        """Generate filename for cardholder PDF."""
        # Clean name for filename
        clean_name = re.sub(r'[^\w\s-]', '', cardholder_name)
        clean_name = re.sub(r'[-\s]+', ' ', clean_name).strip()
        
        if closing_date:
            date_str = closing_date.strftime("%Y-%m-%d")
            return f"{clean_name} {date_str}.pdf"
        else:
            return f"{clean_name}.pdf"
    
    def extract_transactions_from_pdf(self, pdf_path: str) -> List[Dict]:
        """Extract transaction data from a cardholder's PDF."""
        transactions = []
        
        try:
            with pdfplumber.open(pdf_path) as pdf:
                for page in pdf.pages:
                    text = page.extract_text() or ""
                    # This would need to be implemented based on the actual PDF format
                    # For now, returning empty list
                    # transactions.extend(self._parse_transactions(text))
        
        except Exception as e:
            logger.error(f"Error extracting transactions: {str(e)}")
        
        return transactions