import os
import json
from fpdf import FPDF

def create_pdf():
    base_dir = os.path.dirname(os.path.dirname(__file__))
    json_path = os.path.join(base_dir, "frontend", "src", "data", "player_credentials.json")
    
    with open(json_path, 'r') as f:
        credentials = json.load(f)

    pdf = FPDF()
    pdf.add_page()
    
    # Title
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, "KabaddiIQ - Player Login Credentials", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(5)

    # Table Header
    pdf.set_font("Helvetica", "B", 11)
    
    col_w1 = 60
    col_w2 = 80
    col_w3 = 45
    line_h = 8
    
    pdf.cell(col_w1, line_h, "Player Name", border=1, align="C")
    pdf.cell(col_w2, line_h, "Email Address", border=1, align="C")
    pdf.cell(col_w3, line_h, "Password", border=1, align="C", new_x="LMARGIN", new_y="NEXT")
    
    # Table Content
    pdf.set_font("Helvetica", size=10)
    
    for c in credentials:
        # Prevent page breaks in the middle of a row
        if pdf.get_y() > 270:
            pdf.add_page()
            # Reprint headers
            pdf.set_font("Helvetica", "B", 11)
            pdf.cell(col_w1, line_h, "Player Name", border=1, align="C")
            pdf.cell(col_w2, line_h, "Email Address", border=1, align="C")
            pdf.cell(col_w3, line_h, "Password", border=1, align="C", new_x="LMARGIN", new_y="NEXT")
            pdf.set_font("Helvetica", size=10)
            
        pdf.cell(col_w1, line_h, c["name"], border=1)
        pdf.cell(col_w2, line_h, c["email"], border=1)
        pdf.cell(col_w3, line_h, c["password"], border=1, new_x="LMARGIN", new_y="NEXT")

    pdf_out = os.path.join(base_dir, "Player_Credentials.pdf")
    pdf.output(pdf_out)
    print("PDF Successfully Generated:", pdf_out)

if __name__ == "__main__":
    create_pdf()
