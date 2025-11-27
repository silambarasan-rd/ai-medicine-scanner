'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import Tesseract from 'tesseract.js';
import axios from 'axios';

// --- Types ---
interface MedicineData {
  brand_name: string;
  purpose: string[];
  indications: string[];
  active_ingredient: string[];
}

interface ScanResult {
  detectedText: string;
  medicineInfo: MedicineData | null;
}

// --- Helper: Clean the OCR text to find a likely medicine name ---
const extractMedicineName = (text: string): string | null => {
  // 1. Split by lines to process structured text
  const lines = text.split('\n');
  
  // 2. Words to ignore (common on packaging)
  const ignoreList = [
    'tablet', 'tablets', 'capsule', 'capsules', 'mg', 'g', 'ml', 
    'exp', 'date', 'batch', 'mfg', 'store', 'dosage', 'keep', 
    'reach', 'children', 'pharmacy', 'ltd', 'pvt', 'inc', 'tm', 'r'
  ];

  let bestCandidate = '';
  let maxLength = 0;

  lines.forEach((line) => {
    // Clean symbols and numbers
    const cleanLine = line.replace(/[^a-zA-Z\s]/g, '').trim();
    const words = cleanLine.split(/\s+/);

    words.forEach((word) => {
      const lowerWord = word.toLowerCase();
      // Logic: Medicine names are usually long, not in the ignore list, and often capitalized
      if (
        word.length > 4 && 
        !ignoreList.includes(lowerWord)
      ) {
        if (word.length > maxLength) {
          maxLength = word.length;
          bestCandidate = word;
        }
      }
    });
  });

  return bestCandidate || null;
};

export default function MedicineScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 1. Initialize Camera
  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' } // Prefer back camera
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            setIsCameraReady(true);
            videoRef.current?.play();
          };
        }
      } catch (err) {
        console.error("Camera Error:", err);
        setError("Unable to access camera. Please allow permissions.");
      }
    };

    startCamera();

    return () => {
      // Cleanup stream on unmount
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // 2. Fetch Data from OpenFDA
  // const fetchMedicineData = async (queryName: string): Promise<MedicineData | null> => {
  //   try {
  //     // OpenFDA API for Drug Labels
  //     const response = await axios.get(
  //       `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${queryName}"&limit=1`
  //     );

  //     const result = response.data.results?.[0];
      
  //     if (!result) return null;

  //     return {
  //       brand_name: result.openfda?.brand_name?.[0] || queryName,
  //       purpose: result.purpose || ['Purpose not specified'],
  //       indications: result.indications_and_usage || ['Usage details not available'],
  //       active_ingredient: result.active_ingredient || ['Unknown']
  //     };
  //   } catch (err) {
  //     console.warn("API Lookup failed", err);
  //     return null;
  //   }
  // };

  // 2. Fetch Data from our AI API
  const fetchMedicineDataAI = async (ocrText: string): Promise<MedicineData | null> => {
    try {
      const response = await axios.post('/api/identify', { text: ocrText });
      const data = response.data;

      if (data.error) {
        console.warn(data.error);
        return null;
      }

      // Map AI response to our state structure
      return {
        brand_name: data.brand_name,
        purpose: [data.purpose], // Wrap in array to match previous structure
        indications: [data.warnings], // We'll map warnings to indications
        active_ingredient: [data.active_ingredient]
      };
    } catch (err) {
      console.error("AI Request Failed", err);
      return null;
    }
  };

  // 3. Handle Scanning
  const handleScan = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    setIsScanning(true);
    setError(null);
    setScanResult(null);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Draw video frame to canvas
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      // Perform OCR
      const { data: { text } } = await Tesseract.recognize(
        canvas,
        'eng',
        { logger: (m) => console.log(m) } // Optional: see progress in console
      );

      console.log("Raw Text sending to AI:", text);

      // const identifiedName = extractMedicineName(text);

      // if (!identifiedName) {
      //   throw new Error("Could not detect a clear text. Please try again.");
      // }

      // if (text.length < 5) {
      //   throw new Error("No readable text found. Try again.");
      // }

      // Fetch details
      const medicineDetails = await fetchMedicineDataAI(text);

      if (!medicineDetails) {
         throw new Error("AI could not identify a medicine in this text.");
      }

      setScanResult({
        detectedText: medicineDetails.brand_name,
        medicineInfo: medicineDetails
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(errorMessage);
    } finally {
      setIsScanning(false);
    }
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-4">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">AI Medicine Detector</h1>

      {/* Camera Viewport */}
      <div className="relative w-full max-w-md aspect-[3/4] bg-black rounded-xl overflow-hidden shadow-2xl">
        <video 
          ref={videoRef} 
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
        />
        
        {/* Scanning Overlay Effect */}
        {isScanning && (
          <div className="absolute inset-0 bg-white/20 z-10 animate-pulse flex items-center justify-center">
            <span className="text-white font-semibold bg-black/50 px-4 py-2 rounded">Processing...</span>
          </div>
        )}

        {!isCameraReady && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-white">
            Initializing Camera...
          </div>
        )}

        {/* Overlay Guide Box */}
        <div className="absolute inset-0 border-2 border-white/50 m-8 rounded-lg pointer-events-none"></div>
      </div>

      {/* Hidden Canvas for Image Processing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Controls */}
      <div className="mt-8 flex flex-col items-center gap-4 w-full max-w-md">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative w-full text-center">
            {error}
          </div>
        )}

        <button
          onClick={handleScan}
          disabled={!isCameraReady || isScanning}
          className={`
            w-full py-4 rounded-full font-bold text-lg shadow-md transition-all
            ${isScanning || !isCameraReady 
              ? 'bg-gray-400 cursor-not-allowed text-gray-200' 
              : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'
            }
          `}
        >
          {isScanning ? 'Scanning...' : 'Capture & Identify'}
        </button>
      </div>

      {/* Results Section */}
      {scanResult && (
        <div className="mt-8 w-full max-w-md bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="bg-blue-50 px-6 py-4 border-b border-blue-100">
            <span className="text-xs font-semibold text-blue-500 uppercase tracking-wide">Detected Text</span>
            <p className="text-xl font-bold text-gray-800 capitalize">{scanResult.detectedText}</p>
          </div>

          <div className="p-6 space-y-4">
            {scanResult.medicineInfo ? (
              <>
                <div>
                  <h3 className="font-semibold text-gray-700">Purpose</h3>
                  <p className="text-gray-600 text-sm mt-1 leading-relaxed">
                    {scanResult.medicineInfo.purpose[0]}
                  </p>
                </div>
                
                <div>
                  <h3 className="font-semibold text-gray-700">Active Ingredient</h3>
                  <p className="text-gray-600 text-sm mt-1">
                    {scanResult.medicineInfo.active_ingredient.join(', ')}
                  </p>
                </div>

                <div className="bg-yellow-50 p-3 rounded text-xs text-yellow-800 border border-yellow-200">
                  ⚠️ Always consult a doctor. This AI information is for educational purposes only.
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-500">
                  Name detected, but no details found in the FDA database.
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Try identifying the active ingredient manually.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}