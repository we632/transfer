# Copilot Instructions for transfer_app

## Overview
This is a FastAPI web application for managing and exporting transfer logs ("转单记录") as PDFs. It supports multi-language (Chinese, English, Spanish) interfaces and is designed for logistics/driver transfer workflows. The app features a web form for entering transfer data, validation for package ranges, and PDF export with custom fonts (including Chinese support).

## Architecture
- **Backend:** FastAPI (`app.py`) serves HTML pages, handles PDF export, and provides i18n support. Uses Jinja2 for templating and ReportLab for PDF generation.
- **Frontend:**
  - HTML templates in `templates/` (`form.html`, `lang.html`)
  - JavaScript in `static/app.js` for dynamic form logic, row management, and client-side validation
  - CSS in `static/styles.css` for UI styling
- **Static assets:** Served from `/static` (JS, CSS, fonts)
- **Fonts:** Place custom fonts (e.g., NotoSansSC for Chinese) in `fonts/` for PDF output

## Key Workflows
- **Run locally:**
  ```sh
  uvicorn app:app --reload
  ```
- **Access UI:**
  - Go to `/` for language selection, then `/form?lang=xx` for the main form
- **Export PDF:**
  - Fill in transfer rows and blocked ranges, then click "Export PDF" (handled by `/pdf` endpoint)
- **Validation:**
  - Both frontend and backend validate package ranges and block export if ranges overlap with blocked ranges or are marked as locked

## Project Conventions
- **i18n:** All user-facing text is managed via the `I18N` dict in `app.py` and passed to templates as `t`/`t_json`
- **Routes:**
  - `/` → language selection
  - `/form` → main form (with `lang` param)
  - `/pdf` → PDF export (POST)
- **Row Locking:** Each row can be marked as "locked" (不可转/Locked/Bloqueado) to prevent export
- **Routes (logistics):** Route options are A01–A25, generated in JS
- **Validation:**
  - Range format: `100-120` (enforced by regex in backend and JS)
  - Blocked ranges: comma-separated, e.g., `100-120, 205-210`

## Dependencies
- See `requirements.txt` (FastAPI, Uvicorn, Jinja2, ReportLab)
- For Chinese PDF output, ensure `fonts/NotoSansSC-Regular.ttf` is present

## File Guide
- `app.py`: Main FastAPI app, i18n, PDF logic
- `templates/`: Jinja2 HTML templates
- `static/app.js`: Frontend logic (row add/delete, validation, PDF trigger)
- `static/styles.css`: UI styles
- `fonts/`: Custom fonts for PDF

## Tips for AI Agents
- Always keep i18n keys in sync between backend and frontend
- When adding new fields, update both `Row` model (backend) and JS row logic
- Validate all user input on both client and server
- Use the provided CSS classes for UI consistency
- For new languages, extend the `I18N` dict and update templates as needed
