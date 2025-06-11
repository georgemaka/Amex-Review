import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import {
  Box,
  IconButton,
  Typography,
  Paper,
  CircularProgress,
} from '@mui/material';
import {
  ZoomIn,
  ZoomOut,
  NavigateBefore,
  NavigateNext,
  FirstPage,
  LastPage,
} from '@mui/icons-material';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Set worker source
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface PDFViewerProps {
  pdfUrl: string;
  currentPage?: number;
}

const PDFViewer: React.FC<PDFViewerProps> = ({ pdfUrl, currentPage = 1 }) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(currentPage);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
  };

  const changePage = (offset: number) => {
    setPageNumber((prevPageNumber) => {
      const newPageNumber = prevPageNumber + offset;
      return Math.min(Math.max(1, newPageNumber), numPages || 1);
    });
  };

  const changeZoom = (delta: number) => {
    setScale((prevScale) => Math.min(Math.max(0.5, prevScale + delta), 2.0));
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Controls */}
      <Paper
        elevation={2}
        sx={{
          p: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderRadius: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton
            size="small"
            onClick={() => setPageNumber(1)}
            disabled={pageNumber <= 1}
          >
            <FirstPage />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => changePage(-1)}
            disabled={pageNumber <= 1}
          >
            <NavigateBefore />
          </IconButton>
          <Typography variant="body2" sx={{ mx: 2 }}>
            Page {pageNumber} of {numPages || '?'}
          </Typography>
          <IconButton
            size="small"
            onClick={() => changePage(1)}
            disabled={pageNumber >= (numPages || 1)}
          >
            <NavigateNext />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => setPageNumber(numPages || 1)}
            disabled={pageNumber >= (numPages || 1)}
          >
            <LastPage />
          </IconButton>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton
            size="small"
            onClick={() => changeZoom(-0.1)}
            disabled={scale <= 0.5}
          >
            <ZoomOut />
          </IconButton>
          <Typography variant="body2" sx={{ mx: 1 }}>
            {Math.round(scale * 100)}%
          </Typography>
          <IconButton
            size="small"
            onClick={() => changeZoom(0.1)}
            disabled={scale >= 2.0}
          >
            <ZoomIn />
          </IconButton>
        </Box>
      </Paper>

      {/* PDF Display */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          justifyContent: 'center',
          bgcolor: 'grey.200',
          p: 2,
        }}
      >
        {loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        )}
        <Document
          file={pdfUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={<CircularProgress />}
          error={
            <Typography color="error">
              Failed to load PDF. Please check if the file exists.
            </Typography>
          }
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </Document>
      </Box>
    </Box>
  );
};

export default PDFViewer;