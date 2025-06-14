#!/usr/bin/env python3
"""
Script to check BRENT J WALL's PDF content
"""
import pdfplumber
import re


def check_brent_pdf():
    pdf_path = "/app/uploads/statements/14/pdfs/BRENT J WALL.pdf"
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            print(f"PDF has {len(pdf.pages)} pages")
            
            for i, page in enumerate(pdf.pages):
                print(f"\n--- Page {i+1} ---")
                text = page.extract_text()
                if text:
                    # Show the first 500 characters of each page
                    print(f"First 500 chars: {text[:500]}...")
                    print(f"Total text length: {len(text)} characters")
                    
                    # Look for transaction patterns (dates, amounts, descriptions)
                    lines = text.split('\n')
                    transaction_count = 0
                    
                    print(f"\nAnalyzing {len(lines)} lines...")
                    for line in lines:
                        # Look for lines with dates (MM/DD pattern)
                        if re.search(r'\d{2}/\d{2}', line):
                            print(f"  Date line: {line[:150]}")
                            if '$' in line or re.search(r'\d+\.\d{2}', line):
                                transaction_count += 1
                        
                        # Look for the total line
                        if 'Total for' in line:
                            print(f"  TOTAL LINE: {line}")
                    
                    print(f"\nSummary: Found {transaction_count} potential transactions on this page")
                else:
                    print("  No text extracted from this page")
                    
    except Exception as e:
        print(f"Error reading PDF: {e}")


if __name__ == "__main__":
    check_brent_pdf()