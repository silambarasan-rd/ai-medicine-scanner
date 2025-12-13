'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// --- Types ---
interface MedicineData {
  brand_name: string;
  purpose: string;
  active_ingredient: string;
  warnings: string[];
  usage_timing: string;
  safety_flags: {
    drive: boolean;
    alcohol: boolean;
  };
}

interface ScanResult {
  medicineInfo: MedicineData | null;
}

export default function MedicineScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAutoCapture, setIsAutoCapture] = useState(true);

  // Touch tracking state for Bottom Sheet Modal
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

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

  // 3. Fetch Data from our AI API
  const fetchMedicineDataAI = async (base64Image: string): Promise<MedicineData | null> => {
    try {
      const response = await axios.post('/api/identify', { image: base64Image });
      const data = response.data;

      if (data.error) {
        console.warn(data.error);
        return null;
      }

      // Map API response to MedicineData interface
      return {
        brand_name: data.brand_name || "Unknown Medicine",
        purpose: Array.isArray(data.purpose) ? data.purpose : [data.purpose].filter(Boolean),
        // Map 'indications' to 'warnings' with fallback to 'warnings' field
        warnings: Array.isArray(data.indications) ? data.indications : (Array.isArray(data.warnings) ? data.warnings : []),
        active_ingredient: data.active_ingredient ? data.active_ingredient : ['See label for details'],
        usage_timing: data.usage_timing,
        safety_flags: data.safety_flags || { drive: true, alcohol: true }
      };
    } catch (err) {
      console.error("AI Request Failed", err);
      return null;
    }
  };

  // 4. Handle Scanning
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
      // Convert canvas to base64 JPEG
      const dataUrl = canvas.toDataURL('image/jpeg');
      // Strip the "data:image/jpeg;base64," prefix
      const base64Image = dataUrl.replace(/^data:image\/jpeg;base64,/, '');

      // Fetch details from AI API
      const medicineDetails = await fetchMedicineDataAI(base64Image);

      if (!medicineDetails) {
         throw new Error("AI could not identify a medicine in this image.");
      }

      setScanResult({
        medicineInfo: medicineDetails
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(errorMessage);
    } finally {
      setIsScanning(false);
    }
  }, []);

  // 2. Auto-Capture Effect
  useEffect(() => {
    if (!isAutoCapture || !isCameraReady || isScanning || scanResult) return;

    const interval = setInterval(() => {
      if (!isScanning) {
        handleScan();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isAutoCapture, isCameraReady, isScanning, handleScan, scanResult]);

  return (
    <main className="min-h-screen bg-black relative overflow-hidden">
      {/* Header: Title & Toggle */}
      <div className="absolute top-0 z-20 w-full bg-gradient-to-b from-black/70 to-transparent px-4 py-4 flex flex-col items-center">
        <h1 className="text-3xl font-bold text-gray-100 mb-4">💊 MathirAI</h1>
        <div className="flex items-center gap-3 bg-black/50 px-4 py-3 rounded-lg shadow-md border border-gray-700">
          <span className={`text-sm font-medium ${
            isAutoCapture ? 'text-blue-400' : 'text-gray-400'
          }`}>Auto</span>
          <button
            onClick={() => setIsAutoCapture(!isAutoCapture)}
            className={`relative inline-flex items-center h-7 w-14 rounded-full transition-colors ${
              isAutoCapture ? 'bg-blue-600' : 'bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                isAutoCapture ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
          <span className={`text-sm font-medium ${
            !isAutoCapture ? 'text-blue-400' : 'text-gray-400'
          }`}>Manual</span>
        </div>
      </div>
      {/* Fullscreen video */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
      />
      {/* Overlay scanning state */}
      {isScanning && (
        <div className="absolute inset-0 bg-white/20 z-10 animate-pulse flex items-center justify-center">
          <span className="text-white font-semibold bg-black/50 px-4 py-2 rounded">Processing...</span>
        </div>
      )}
      {/* Overlay initializing state */}
      {!isCameraReady && !error && (
        <div className="absolute inset-0 flex items-center justify-center text-white z-10">
          Initializing Camera...
        </div>
      )}
      {/* Overlay guide box */}
      <div className="absolute inset-0 border-2 border-white/50 m-8 rounded-lg pointer-events-none"></div>
      {/* Hidden canvas for processing */}
      <canvas ref={canvasRef} className="hidden" />
      {/* Controls at bottom */}
      <div className="absolute bottom-10 z-20 w-full max-w-md mx-auto px-4">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative w-full text-center">
            {error}
          </div>
        )}
        {!isAutoCapture && (
          <button
            onClick={handleScan}
            disabled={!isCameraReady || isScanning}
            className={`w-full py-4 rounded-full font-bold text-lg shadow-md transition-all
              ${isScanning || !isCameraReady
                ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'
              }
            `}
          >
            {isScanning ? 'Scanning...' : 'Capture & Identify'}
          </button>
        )}
      </div>

      {/* Bottom Sheet Modal for Results */}
      {scanResult && scanResult.medicineInfo && (
        <div className="absolute inset-0 z-50 bg-black/60 flex justify-center items-end">
          <div
            className="w-full max-w-md rounded-t-3xl bg-white bottom-0 absolute p-6 pt-12"
            onTouchStart={(e) => {
              if(e.touches && e.touches.length > 0) {
                setTouchStart(e.touches[0].clientY);
              }
            }}
            onTouchEnd={(e) => {
              if(e.changedTouches && e.changedTouches.length > 0) {
                setTouchEnd(e.changedTouches[0].clientY);
                if (touchStart !== null && (touchStart - e.changedTouches[0].clientY) < -75) {
                  setScanResult(null);
                }
              }
            }}
          >
            {/* Drag Handle */}
            <div className="w-12 h-1.5 bg-gray-400 rounded-full absolute top-4 left-1/2 transform -translate-x-1/2"></div>

            <button
              aria-label="Close"
              onClick={() => setScanResult(null)}
              className="absolute top-4 right-4 bg-gray-200 rounded-full p-2 z-50 text-gray-700 hover:text-gray-900 text-3xl font-bold"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-xl font-bold text-gray-900 mb-3 capitalize">{scanResult.medicineInfo.brand_name}</h2>
            <div className="mb-4">
              <h3 className="font-semibold text-gray-700 uppercase text-sm mb-1">How to Take</h3>
              <p className="text-gray-800 font-semibold text-base">{scanResult.medicineInfo.usage_timing}</p>
            </div>

            <div className="flex gap-4 mb-4">
              {!scanResult.medicineInfo.safety_flags.drive && (
                <div className="flex-1 bg-red-100 border border-red-300 rounded-lg p-3 flex flex-col items-center justify-center">
                  <div className="text-3xl mb-1">🚗</div>
                  <p className="text-xs font-bold text-red-700 uppercase">Do Not Drive</p>
                </div>
              )}
              {!scanResult.medicineInfo.safety_flags.alcohol && (
                <div className="flex-1 bg-red-100 border border-red-300 rounded-lg p-3 flex flex-col items-center justify-center">
                  <div className="text-3xl mb-1">🍷</div>
                  <p className="text-xs font-bold text-red-700 uppercase">No Alcohol</p>
                </div>
              )}
            </div>

            <div className="mb-4">
              <h3 className="font-semibold text-gray-700">Purpose</h3>
              <p className="text-gray-600 text-sm leading-relaxed mt-1">{scanResult.medicineInfo.purpose}</p>
            </div>

            <div className="mb-4">
              <h3 className="font-semibold text-gray-700">Active Ingredient</h3>
              <p className="text-gray-600 text-sm mt-1">{scanResult.medicineInfo.active_ingredient}</p>
            </div>

            {scanResult.medicineInfo.warnings.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <h3 className="font-semibold text-yellow-900 text-sm mb-2">⚠️ Warnings</h3>
                <ul className="text-xs text-yellow-800 space-y-1">
                  {scanResult.medicineInfo.warnings.map((warning, idx) => (
                    <li key={idx} className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="bg-blue-50 p-3 rounded text-xs text-blue-800 border border-blue-200">
              ℹ️ Always consult a doctor. This AI information is for educational purposes only.
            </div>
          </div>
        </div>
      )}
    </main>
  );
}