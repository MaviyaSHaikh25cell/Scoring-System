import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';

export type PdfTextItem = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PdfPageData = {
  pageNumber: number;
  width: number;
  height: number;
  items: PdfTextItem[];
};

export type PdfTextExtractorHandle = {
  extract: (pdfUri: string) => Promise<PdfPageData[]>;
};

type PendingRequest = {
  resolve: (pages: PdfPageData[]) => void;
  reject: (error: Error) => void;
};

const PDF_JS_URL =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';

const PDF_WORKER_URL =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

const PdfTextExtractor = forwardRef<PdfTextExtractorHandle>(
  function PdfTextExtractor(_, ref) {
    const webViewRef = useRef<WebView>(null);
    const pendingRequestRef = useRef<PendingRequest | null>(null);

    const [htmlReady, setHtmlReady] = useState(false);

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  />

  <style>
    html,
    body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: transparent;
      overflow: hidden;
    }

    body {
      font-family: Arial, sans-serif;
    }
  </style>
</head>

<body>

<script src="${PDF_JS_URL}"></script>

<script>
(function () {
  const WORKER_URL = ${JSON.stringify(PDF_WORKER_URL)};

  function sendMessage(payload) {
    if (
      window.ReactNativeWebView &&
      window.ReactNativeWebView.postMessage
    ) {
      window.ReactNativeWebView.postMessage(
        JSON.stringify(payload)
      );
    }
  }

  function base64ToUint8Array(base64) {
    const binaryString = window.atob(base64);

    const length = binaryString.length;
    const bytes = new Uint8Array(length);

    for (let i = 0; i < length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return bytes;
  }

  function roundNumber(value) {
    return Math.round(value * 100) / 100;
  }

  async function extractPdf(base64) {
    try {
      if (!window.pdfjsLib) {
        throw new Error(
          'PDF.js failed to load inside the WebView.'
        );
      }

      window.pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_URL;

      const pdfData = base64ToUint8Array(base64);

      const loadingTask = window.pdfjsLib.getDocument({
        data: pdfData,
        disableAutoFetch: false,
        disableStream: false
      });

      const pdf = await loadingTask.promise;

      const pages = [];

      for (
        let pageNumber = 1;
        pageNumber <= pdf.numPages;
        pageNumber++
      ) {
        const page = await pdf.getPage(pageNumber);

        const viewport = page.getViewport({
          scale: 1
        });

        const textContent = await page.getTextContent();

        const items = [];

        for (const item of textContent.items) {
          if (!item || typeof item.str !== 'string') {
            continue;
          }

          const text = item.str.trim();

          if (!text) {
            continue;
          }

          const transform = item.transform || [];

          const x =
            typeof transform[4] === 'number'
              ? transform[4]
              : 0;

          const y =
            typeof transform[5] === 'number'
              ? viewport.height - transform[5]
              : 0;

          const width =
            typeof item.width === 'number'
              ? item.width
              : 0;

          const height =
            typeof item.height === 'number'
              ? item.height
              : 0;

          items.push({
            text,
            x: roundNumber(x),
            y: roundNumber(y),
            width: roundNumber(width),
            height: roundNumber(height)
          });
        }

        pages.push({
          pageNumber,
          width: roundNumber(viewport.width),
          height: roundNumber(viewport.height),
          items
        });
      }

      sendMessage({
        type: 'PDF_EXTRACTION_SUCCESS',
        pages
      });
    } catch (error) {
      sendMessage({
        type: 'PDF_EXTRACTION_ERROR',
        message:
          error && error.message
            ? error.message
            : String(error)
      });
    }
  }

  window.extractTournamentPdf = extractPdf;

  sendMessage({
    type: 'PDF_WEBVIEW_READY'
  });
})();
</script>

</body>
</html>
`;

    const handleMessage = (event: WebViewMessageEvent) => {
      try {
        const message = JSON.parse(event.nativeEvent.data);

        if (message.type === 'PDF_WEBVIEW_READY') {
          setHtmlReady(true);
          return;
        }

        if (message.type === 'PDF_EXTRACTION_SUCCESS') {
          const pending = pendingRequestRef.current;

          if (!pending) {
            return;
          }

          pendingRequestRef.current = null;

          pending.resolve(
            Array.isArray(message.pages)
              ? message.pages
              : []
          );

          return;
        }

        if (message.type === 'PDF_EXTRACTION_ERROR') {
          const pending = pendingRequestRef.current;

          if (!pending) {
            return;
          }

          pendingRequestRef.current = null;

          pending.reject(
            new Error(
              message.message ||
                'Unable to extract text from PDF.'
            )
          );
        }
      } catch {
        const pending = pendingRequestRef.current;

        if (!pending) {
          return;
        }

        pendingRequestRef.current = null;

        pending.reject(
          new Error(
            'Invalid response received from PDF WebView.'
          )
        );
      }
    };

    useImperativeHandle(
      ref,
      () => ({
        extract: async (pdfUri: string) => {
          if (!pdfUri) {
            throw new Error('PDF file URI is missing.');
          }

          if (!htmlReady) {
            throw new Error(
              'PDF extractor is still loading. Please try again.'
            );
          }

          if (pendingRequestRef.current) {
            throw new Error(
              'Another PDF is currently being processed.'
            );
          }

          const base64 = await FileSystem.readAsStringAsync(
            pdfUri,
            {
              encoding: FileSystem.EncodingType.Base64,
            }
          );

          return new Promise<PdfPageData[]>(
            (resolve, reject) => {
              pendingRequestRef.current = {
                resolve,
                reject,
              };

              const safeBase64 = JSON.stringify(base64);

              webViewRef.current?.injectJavaScript(
                `
                  if (
                    window.extractTournamentPdf
                  ) {
                    window.extractTournamentPdf(
                      ${safeBase64}
                    );
                  } else {
                    window.ReactNativeWebView.postMessage(
                      JSON.stringify({
                        type: 'PDF_EXTRACTION_ERROR',
                        message:
                          'PDF extractor is not ready.'
                      })
                    );
                  }

                  true;
                `
              );
            }
          );
        },
      }),
      [htmlReady]
    );

    return (
      <View
        pointerEvents="none"
        style={styles.container}
      >
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html }}
          onMessage={handleMessage}
          javaScriptEnabled
          domStorageEnabled
          allowFileAccess
          allowUniversalAccessFromFileURLs
          mixedContentMode="always"
          style={styles.webView}
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    left: 0,
    top: 0,
  },

  webView: {
    width: 1,
    height: 1,
    backgroundColor: 'transparent',
  },
});

export default PdfTextExtractor;