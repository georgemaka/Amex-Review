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
        # Patterns that indicate a blank or header-only page
        self.blank_page_patterns = [
            r"Activity Continued",
            r"^\s*Page \d+ of \d+\s*$",  # Only page number
            r"This page intentionally left blank",
        ]
        # Common header elements to identify
        self.header_elements = [
            'PREPARED FOR', 'ACCOUNT NUMBER', 'CLOSING DATE', 
            'ACTIVITY CONTINUED', 'PAGE', 'AMERICAN EXPRESS',
            'SUKUT CONSTRUCTION', 'EJIM BEHRENS/CBA'
        ]
    
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
            
            # Also check pages with pdfplumber to get blank pages list from first pass
            with pdfplumber.open(pdf_path) as pdf_check:
                blank_pages_set = set()
                for page_num, page in enumerate(pdf_check.pages, 1):
                    text = page.extract_text() or ""
                    if self._is_blank_or_header_only_page(text):
                        blank_pages_set.add(page_num)
            
            for cardholder_name, page_range in cardholder_pages.items():
                if cardholder_name in self.skip_names:
                    continue
                
                writer = PdfWriter()
                pages_added = 0
                for page_num in range(page_range[0] - 1, page_range[1]):
                    # Skip blank/header-only pages except for the last page (which should have the total)
                    actual_page_num = page_num + 1  # Convert to 1-based
                    if actual_page_num in blank_pages_set and actual_page_num != page_range[1]:
                        logger.info(f"Skipping blank page {actual_page_num} from {cardholder_name}'s PDF")
                        continue
                    writer.add_page(reader.pages[page_num])
                    pages_added += 1
                
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
                    "pages_in_pdf": pages_added,
                    "closing_date": closing_date
                }
                
                logger.info(f"Created PDF for {cardholder_name}: {filename} (pages {page_range[0]}-{page_range[1]}, {pages_added} pages in final PDF)")
        
        except Exception as e:
            logger.error(f"Error processing PDF: {str(e)}")
            raise
        
        return results
    
    def _find_cardholder_sections(self, pdf) -> Dict[str, Tuple[int, int]]:
        """Find page ranges for each cardholder."""
        cardholder_pages = {}
        cardholder_totals = []  # List of (page_num, name) tuples
        blank_pages = []
        summary_pages = []
        
        logger.info(f"Starting PDF split analysis for {len(pdf.pages)} pages")
        
        # First pass: Find all "Total for NAME" pages and identify blank pages
        first_total_found = False
        for page_num, page in enumerate(pdf.pages, 1):
            text = page.extract_text() or ""
            
            # Look for cardholder totals FIRST (before blank page check)
            matches = self.cardholder_pattern.findall(text)
            
            if matches:
                cardholder_name = matches[0].strip()
                cardholder_totals.append((page_num, cardholder_name))
                logger.info(f"Page {page_num}: Found 'Total for {cardholder_name}'")
                first_total_found = True
            elif self._is_blank_or_header_only_page(text):
                # Check for blank pages AFTER checking for totals
                blank_pages.append(page_num)
                logger.debug(f"Page {page_num}: Blank or header-only page")
            elif not first_total_found:
                # Pages before first "Total for" are summary pages
                summary_pages.append(page_num)
                logger.debug(f"Page {page_num}: Summary page (before first cardholder)")
        
        logger.info(f"Found {len(cardholder_totals)} cardholder totals")
        logger.info(f"Skipping {len(summary_pages)} summary pages at start")
        logger.info(f"Found {len(blank_pages)} blank pages throughout document")
        
        # Second pass: Assign page ranges
        last_assigned_end = 0  # Track the last assigned end page
        
        for i, (end_page, name) in enumerate(cardholder_totals):
            if name in self.skip_names:
                logger.info(f"Skipping cardholder: {name}")
                last_assigned_end = end_page  # Update last end even for skipped cardholders
                continue
                
            if i == 0 or last_assigned_end == 0:
                # First cardholder (or first after skipped ones) starts after summary pages
                start_page = 1
                # Find first non-blank, non-summary page
                for p in range(1, end_page):
                    if p not in blank_pages and p not in summary_pages:
                        text = pdf.pages[p-1].extract_text() or ""
                        # Make sure it's not another total page
                        if "Total for" not in text and len(text.strip()) > 50:
                            start_page = p
                            break
            else:
                # Start after previous assigned cardholder's total page
                start_page = last_assigned_end + 1
                # Skip any blank pages
                while start_page < end_page:
                    if start_page in blank_pages:
                        logger.debug(f"Skipping blank page {start_page} between cardholders")
                        start_page += 1
                    else:
                        # Double-check the page isn't blank (in case we missed it in first pass)
                        page_text = pdf.pages[start_page-1].extract_text() or ""
                        if self._is_blank_or_header_only_page(page_text):
                            logger.debug(f"Skipping header-only page {start_page} between cardholders")
                            blank_pages.append(start_page)  # Add to list for consistency
                            start_page += 1
                        else:
                            break
            
            # Validate we have a valid range
            if start_page <= end_page:  # Allow single-page cardholders
                cardholder_pages[name] = (start_page, end_page)
                logger.info(f"Assigned {name}: pages {start_page}-{end_page} ({end_page - start_page + 1} pages)")
                last_assigned_end = end_page  # Update last assigned end
            else:
                logger.warning(f"Invalid page range for {name}: start={start_page}, end={end_page}")
        
        # Log summary
        logger.info(f"PDF split summary: Assigned {len(cardholder_pages)} cardholders")
        total_pages_assigned = sum(end - start + 1 for start, end in cardholder_pages.values())
        total_pages_skipped = len(summary_pages) + len([p for p in blank_pages if p not in summary_pages])
        logger.info(f"Total pages assigned: {total_pages_assigned}")
        logger.info(f"Total pages skipped: {total_pages_skipped} ({len(summary_pages)} summary, {len(blank_pages)} blank)")
        logger.info(f"Total pages in PDF: {len(pdf.pages)}")
        
        # Check for gaps or overlaps
        all_assigned_pages = set()
        for name, (start, end) in cardholder_pages.items():
            page_range = set(range(start, end + 1))
            if all_assigned_pages & page_range:
                logger.error(f"ERROR: Page overlap detected for {name}!")
            all_assigned_pages.update(page_range)
        
        # Log final assignments
        for name, (start, end) in sorted(cardholder_pages.items(), key=lambda x: x[1][0]):
            logger.info(f"  - {name}: pages {start}-{end} ({end - start + 1} pages)")
        
        return cardholder_pages
    
    def _is_blank_or_header_only_page(self, text: str) -> bool:
        """
        Check if a page is blank or contains only header/footer information.
        Be conservative - only mark truly blank pages.
        """
        # First check if text is too short
        if len(text.strip()) < 50:
            return True
        
        # Check for transaction indicators FIRST - if found, it's NOT blank
        transaction_indicators = [
            r'\$[\d,]+\.\d{2}',  # Dollar amounts
            r'Total for',  # Total pages are never blank
            r'Transaction\s+Date',  # Transaction headers
            r'Reference\s+Number',
            # Look for date patterns that appear in transactions
            r'\d{2}/\d{2}/\d{2,4}\s+\d{2}/\d{2}/\d{2,4}',  # Transaction date + posting date pattern
            # Merchant names often have these patterns
            r'(PAYMENT|PURCHASE|CREDIT|DEBIT)',
        ]
        
        for indicator in transaction_indicators:
            if re.search(indicator, text, re.IGNORECASE):
                return False  # Not blank if it has transaction data
        
        # Check for known blank page patterns
        if "Activity Continued" in text:
            # Mark as blank if it's an "Activity Continued" page with no transactions
            # Count non-header content
            lines = text.strip().split('\n')
            content_lines = 0
            has_transaction_content = False
            
            for line in lines:
                line_stripped = line.strip()
                # Skip obvious header/footer lines
                if any(x in line_stripped.upper() for x in self.header_elements):
                    continue
                # Check if line has meaningful transaction content
                if len(line_stripped) > 10:  # Meaningful content
                    content_lines += 1
                    # Look for transaction-like content (dates, amounts, merchant names)
                    if any(char.isdigit() for char in line_stripped):
                        has_transaction_content = True
            
            # If very little content and no transaction data, it's blank
            if content_lines < 3 and not has_transaction_content:
                return True
        
        # For any other page, default to NOT blank
        # This ensures we don't accidentally exclude transaction pages
        return False
    
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
                    total_count = 0
                    cardholder_total_found = False
                    
                    for page_num, page in enumerate(pdf.pages, 1):
                        page_text = page.extract_text() or ""
                        full_text += page_text + "\n"
                        
                        # Count all "Total for" occurrences
                        total_matches = self.cardholder_pattern.findall(page_text)
                        for match in total_matches:
                            total_count += 1
                            found_name = match.strip()
                            
                            if found_name == cardholder_name:
                                cardholder_total_found = True
                                logger.debug(f"{cardholder_name}'s PDF: Found own total on page {page_num}")
                            else:
                                warnings.append(f"Page {page_num}: Found 'Total for {found_name}' in {cardholder_name}'s PDF!")
                                logger.error(f"Cross-contamination: Found '{found_name}' on page {page_num} of {cardholder_name}'s PDF")
                    
                    # Check if cardholder's own total is present
                    if not cardholder_total_found:
                        warnings.append(f"Missing 'Total for {cardholder_name}' in their own PDF!")
                        logger.warning(f"{cardholder_name}'s PDF missing their own total line")
                    
                    # Check for any other cardholder names in the text (not just totals)
                    for other_cardholder in all_cardholders:
                        if other_cardholder != cardholder_name:
                            # More aggressive check - look for name anywhere in text
                            if other_cardholder.upper() in full_text.upper():
                                # Only warn if it's in a transaction context, not just a reference
                                pattern = f"(Transaction|Amount|{other_cardholder}.*\\$)"
                                if re.search(pattern, full_text, re.IGNORECASE):
                                    if f"Total for {other_cardholder}" not in [w for w in warnings if other_cardholder in w]:
                                        warnings.append(f"Possible transaction data for '{other_cardholder}' found in {cardholder_name}'s PDF")
                    
                    # Log stats
                    page_count = len(pdf.pages)
                    logger.info(f"Validated {cardholder_name}: {page_count} pages, {total_count} total line(s), text length: {len(full_text)}")
                    
                    if warnings:
                        validation_results[cardholder_name] = warnings
                    
            except Exception as e:
                logger.error(f"Error validating {cardholder_name}'s PDF: {str(e)}")
                validation_results[cardholder_name] = [f"Validation error: {str(e)}"]
        
        # Summary
        if validation_results:
            logger.error(f"VALIDATION FAILED: Found issues in {len(validation_results)} out of {len(split_results)} PDFs")
            for name, issues in validation_results.items():
                logger.error(f"  {name}: {len(issues)} issue(s)")
                for issue in issues:
                    logger.error(f"    - {issue}")
        else:
            logger.info("VALIDATION PASSED: All PDFs correctly split with no cross-contamination")
        
        return validation_results