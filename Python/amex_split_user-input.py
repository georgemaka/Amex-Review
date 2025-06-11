import os
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

def find_user_page_ranges(pdf_path):
    import pdfplumber
    import re
    from datetime import datetime

    def is_blank_page(text):
        lines = text.strip().split('\n')
        return len(lines) == 3 and "Closing Date" not in lines[0]

    def extract_closing_date(text):
        lines = text.split('\n')
        for line in lines:
            if "J BEHRENS FIELD 2" in line:
                match = re.search(r'(\d{2}/\d{2}/\d{2})$', line)
                if match:
                    date_str = match.group(1)
                    date_obj = datetime.strptime(date_str, '%m/%d/%y')
                    return date_obj.strftime('%Y-%m-%d')
        return None

    users = []
    start_page = None
    closing_date = None
    
    with pdfplumber.open(pdf_path) as pdf:
        total_pages = len(pdf.pages)
        skip_next = True  # To skip the first "J BEHRENS FIELD 2" and the next page
        
        for page_num, page in enumerate(pdf.pages, 1):
            text = page.extract_text()
            
            if closing_date is None:
                closing_date = extract_closing_date(text)

            if skip_next:
                if "Total for J BEHRENS FIELD 2" in text:
                    skip_next = False
                continue

            if is_blank_page(text):
                start_page = None
                continue

            total_match = re.search(r'Total for (.+?)(?= New Charges)', text)
            if total_match:
                user = total_match.group(1).strip()
                if start_page is None:
                    start_page = page_num
                users.append((user, list(range(start_page, page_num + 1))))
                start_page = None
            elif start_page is None:
                start_page = page_num

    return users, closing_date

def save_user_pdfs(pdf_path, user_ranges, closing_date, output_dir):
    from PyPDF2 import PdfReader, PdfWriter

    pdf_reader = PdfReader(pdf_path)
    files_created = 0
    
    for user, pages in user_ranges:
        pdf_writer = PdfWriter()
        for page_num in pages:
            pdf_writer.add_page(pdf_reader.pages[page_num - 1])
        
        user_name = ' '.join(word.capitalize() for word in user.split())
        output_filename = f"{user_name} {closing_date}.pdf"
        output_filename = "".join(c for c in output_filename if c.isalnum() or c in (' ', '-', '_', '.'))
        output_path = os.path.join(output_dir, output_filename)
        
        with open(output_path, 'wb') as output_file:
            pdf_writer.write(output_file)
        
        files_created += 1

    return files_created

class Application(tk.Tk):
    def __init__(self):
        super().__init__()

        self.title("Sukut - AMEX PDF Splitter")
        self.geometry("600x400")

        self.create_widgets()

    def create_widgets(self):
        # PDF File Selection
        tk.Label(self, text="Select PDF file:").grid(row=0, column=0, sticky="w", padx=5, pady=5)
        self.pdf_entry = tk.Entry(self, width=50)
        self.pdf_entry.grid(row=0, column=1, padx=5, pady=5)
        tk.Button(self, text="Browse", command=self.browse_pdf).grid(row=0, column=2, padx=5, pady=5)

        # Output Directory Selection
        tk.Label(self, text="Output directory:").grid(row=1, column=0, sticky="w", padx=5, pady=5)
        self.output_entry = tk.Entry(self, width=50)
        self.output_entry.grid(row=1, column=1, padx=5, pady=5)
        tk.Button(self, text="Browse", command=self.browse_output).grid(row=1, column=2, padx=5, pady=5)

        # Split PDF Button
        tk.Button(self, text="Split PDF", command=self.split_pdf).grid(row=2, column=1, pady=10)

        # Output Text
        self.output_text = tk.Text(self, height=15, width=70)
        self.output_text.grid(row=3, column=0, columnspan=3, padx=5, pady=5)

        # Scrollbar for Output Text
        scrollbar = ttk.Scrollbar(self, orient="vertical", command=self.output_text.yview)
        scrollbar.grid(row=3, column=3, sticky="ns")
        self.output_text.configure(yscrollcommand=scrollbar.set)

    def browse_pdf(self):
        filename = filedialog.askopenfilename(filetypes=[("PDF Files", "*.pdf")])
        self.pdf_entry.delete(0, tk.END)
        self.pdf_entry.insert(0, filename)

    def browse_output(self):
        directory = filedialog.askdirectory()
        self.output_entry.delete(0, tk.END)
        self.output_entry.insert(0, directory)

    def split_pdf(self):
        pdf_path = self.pdf_entry.get()
        output_dir = self.output_entry.get()

        if not pdf_path or not output_dir:
            messagebox.showerror("Error", "Please select both a PDF file and an output directory.")
            return

        self.output_text.delete(1.0, tk.END)
        self.output_text.insert(tk.END, "Processing PDF...\n")
        self.update_idletasks()

        try:
            user_ranges, closing_date = find_user_page_ranges(pdf_path)
            self.output_text.insert(tk.END, f"Closing Date: {closing_date}\n")
            for user, pages in user_ranges:
                self.output_text.insert(tk.END, f"{user}: {pages}\n")

            total_files = save_user_pdfs(pdf_path, user_ranges, closing_date, output_dir)

            self.output_text.insert(tk.END, f"\nTotal Files Created: {total_files}\n")
            self.output_text.insert(tk.END, f"Files have been saved in: {output_dir}\n")
        except Exception as e:
            messagebox.showerror("Error", f"An error occurred: {str(e)}")

if __name__ == "__main__":
    app = Application()
    app.mainloop()