# Document Worker

Python worker for documents, especially PDFs.

Responsibilities:

- Consume tasks from the document queue.
- Download files from MinIO.
- Extract text with PyMuPDF or pdfplumber.
- Store processed artifacts when applicable.
- Create a secondary text-analysis task.
- Handle documents without text or documents that cannot be processed.
