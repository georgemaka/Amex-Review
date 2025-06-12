#!/usr/bin/env python3
"""
Test script for PDF splitting functionality
"""
import os
import sys
import logging
from app.services.pdf_processor import PDFProcessor

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

def test_pdf_split(pdf_path: str):
    """Test PDF splitting with validation"""
    print(f"\n=== Testing PDF Split for: {pdf_path} ===\n")
    
    # Create processor
    processor = PDFProcessor()
    
    # Create output directory
    output_dir = "/tmp/pdf_split_test"
    os.makedirs(output_dir, exist_ok=True)
    
    try:
        # Split the PDF
        print("Splitting PDF...")
        results = processor.split_by_cardholder(pdf_path, output_dir)
        
        print(f"\nSplit complete! Found {len(results)} cardholders:")
        for name, info in results.items():
            print(f"  - {name}: pages {info['page_start']}-{info['page_end']} -> {info['filename']}")
        
        # Validate the split
        print("\nValidating splits...")
        validation_issues = processor.validate_split(results)
        
        if validation_issues:
            print("\n⚠️  VALIDATION ISSUES FOUND:")
            for cardholder, issues in validation_issues.items():
                print(f"\n  {cardholder}:")
                for issue in issues:
                    print(f"    - {issue}")
        else:
            print("\n✅ Validation passed! All splits appear clean.")
        
        print(f"\nOutput files saved to: {output_dir}")
        
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    if len(sys.argv) > 1:
        pdf_path = sys.argv[1]
    else:
        # Default to example PDF
        pdf_path = "/tmp/test.pdf"
    
    if os.path.exists(pdf_path):
        test_pdf_split(pdf_path)
    else:
        print(f"PDF file not found: {pdf_path}")