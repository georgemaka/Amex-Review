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
        # Updated pattern to handle cases with no space before dollar amount or text after name
        self.cardholder_pattern = re.compile(r"Total for (.+?)(?:New Charges|Previous Balance|\$|$)", re.IGNORECASE)
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
                
                logger.info(f"Created PDF for {cardholder_name}: {filename} (pages {page_range[0]}-{page_range[1]})")
        
        except Exception as e:
            logger.error(f"Error processing PDF: {str(e)}")
            raise
        
        return results
    
    def _find_cardholder_sections(self, pdf) -> Dict[str, Tuple[int, int]]:
        """Find page ranges for each cardholder."""
        cardholder_pages = {}
        current_cardholder = None
        start_page = None
        
        logger.info(f"Starting PDF split analysis for {len(pdf.pages)} pages")
        
        for page_num, page in enumerate(pdf.pages, 1):
            text = page.extract_text() or ""
            
            # Skip blank pages
            if len(text.strip()) < 50:
                logger.debug(f"Page {page_num}: Skipping blank page")
                continue
            
            # Look for cardholder totals
            matches = self.cardholder_pattern.findall(text)
            
            if matches:
                logger.info(f"Page {page_num}: Found cardholder pattern: '{matches[0]}'")
                
                # If we were tracking a cardholder, save their page range
                if current_cardholder and start_page:
                    # Use page_num - 1 to exclude the current page (which has the next cardholder's total)
                    end_page = page_num - 1
                    cardholder_pages[current_cardholder] = (start_page, end_page)
                    logger.info(f"  Assigned {current_cardholder}: pages {start_page}-{end_page} ({end_page - start_page + 1} pages)")
                
                # Start tracking new cardholder
                current_cardholder = matches[0].strip()
                start_page = page_num
                logger.info(f"  Now tracking: {current_cardholder} starting at page {start_page}")
        
        # Save the last cardholder
        if current_cardholder and start_page:
            cardholder_pages[current_cardholder] = (start_page, len(pdf.pages))
            logger.info(f"  Final cardholder {current_cardholder}: pages {start_page}-{len(pdf.pages)} ({len(pdf.pages) - start_page + 1} pages)")
        
        # Log summary
        logger.info(f"PDF split summary: Found {len(cardholder_pages)} cardholders")
        total_pages_assigned = sum(end - start + 1 for start, end in cardholder_pages.values())
        logger.info(f"Total pages assigned: {total_pages_assigned} out of {len(pdf.pages)} pages")
        
        for name, (start, end) in sorted(cardholder_pages.items()):
            logger.info(f"  - {name}: pages {start}-{end} ({end - start + 1} pages)")
        
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
    
    def validate_split(self, split_results: Dict[str, Dict]) -> Dict[str, List[str]]:
        """
        Validate that each split PDF contains only one cardholder's data.
        Returns dict of warnings/errors found.
        """
        validation_results = {}
        all_cardholders = list(split_results.keys())
        
        logger.info("Starting split validation...")
        
        for cardholder_name, info in split_results.items():
            pdf_path = info['path']
            warnings = []
            
            try:
                with pdfplumber.open(pdf_path) as pdf:
                    full_text = ""
                    for page in pdf.pages:
                        full_text += (page.extract_text() or "") + "\n"
                    
                    # Check if any other cardholder names appear in this PDF
                    for other_cardholder in all_cardholders:
                        if other_cardholder != cardholder_name:
                            # Look for "Total for OTHER_NAME" pattern
                            if f"Total for {other_cardholder}" in full_text:
                                warnings.append(f"Found '{other_cardholder}' data in {cardholder_name}'s PDF!")
                                logger.warning(f"Cross-contamination detected: {other_cardholder} found in {cardholder_name}'s PDF")
                    
                    # Log some stats
                    page_count = len(pdf.pages)
                    logger.info(f"Validated {cardholder_name}: {page_count} pages, text length: {len(full_text)}")
                    
                    if warnings:
                        validation_results[cardholder_name] = warnings
                    
            except Exception as e:
                logger.error(f"Error validating {cardholder_name}'s PDF: {str(e)}")
                validation_results[cardholder_name] = [f"Validation error: {str(e)}"]
        
        if validation_results:
            logger.warning(f"Validation found issues in {len(validation_results)} PDFs")
        else:
            logger.info("Validation complete: All PDFs appear to be correctly split")
        
        return validation_results