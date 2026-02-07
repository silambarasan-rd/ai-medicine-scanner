'use client';

import React, { useRef, useState, useCallback } from 'react';
import axios from 'axios';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCar, faTriangleExclamation, faWineGlass } from '@fortawesome/free-solid-svg-icons';

interface MedicineData {
  brand_name: string;
  dosage?: string;
  purpose: string | string[];
  active_ingredient: string | string[];
  warnings: string[];
  usage_timing: string;
  safety_flags: {
    drive: boolean;
    alcohol: boolean;
  };
}

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (medicineData: MedicineData) => void;
}

export default function ScannerModal({ isOpen, onClose, onConfirm }: ScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const supabase = createClient();

  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<MedicineData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAutoCapture, setIsAutoCapture] = useState(true);

  // Initialize Camera
  React.useEffect(() => {
    if (!isOpen) return;

    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            setIsCameraReady(true);
            videoRef.current?.play();
          };
        }
      } catch (err) {
        console.error('Camera Error:', err);
        setError('Unable to access camera. Please allow permissions.');
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isOpen]);

  const fetchMedicineDataAI = async (
    base64Image: string,
    signal: AbortSignal
  ): Promise<MedicineData | null> => {
    try {
      const normalizeStringArray = (value: unknown): string[] => {
        if (!value) return [];
        if (Array.isArray(value)) return value.filter(Boolean).map(String);
        if (typeof value === 'string') return [value];
        return [];
      };

      const response = await axios.post('/api/identify', { image: base64Image }, { signal });
      const data = response.data;

      if (data.error) {
        console.warn(data.error);
        return null;
      }

      const warnings = normalizeStringArray(data.indications ?? data.warnings);
      const activeIngredient = normalizeStringArray(
        data.active_ingredient ?? data.active_ingredients ?? data.activeIngredients ?? data.activeIngredient
      );
      const purpose = normalizeStringArray(data.purpose);
      const dosageValue = data.dosage ?? data.strength ?? data.dose ?? '';
      const dosage = Array.isArray(dosageValue) ? dosageValue.join(', ') : String(dosageValue || '').trim();

      return {
        brand_name: data.brand_name || 'Unknown Medicine',
        dosage: dosage || undefined,
        purpose: purpose.length > 0 ? purpose : ['Not specified'],
        warnings,
        active_ingredient: activeIngredient.length > 0 ? activeIngredient : ['See label for details'],
        usage_timing: data.usage_timing,
        safety_flags: data.safety_flags || { drive: true, alcohol: true },
      };
    } catch (err) {
      if (axios.isCancel(err)) {
        console.log('AI Request was canceled.');
      }
      console.error('AI Request Failed', err);
      return null;
    }
  };

  const handleScan = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsScanning(true);
    setError(null);
    setScanResult(null);

    abortControllerRef.current = new AbortController();

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      const dataUrl = canvas.toDataURL('image/jpeg');
      const base64Image = dataUrl.replace(/^data:image\/jpeg;base64,/, '');

      const medicineDetails = await fetchMedicineDataAI(
        base64Image,
        abortControllerRef.current.signal
      );

      if (!medicineDetails) {
        throw new Error('AI could not identify a medicine in this image.');
      }

      setScanResult(medicineDetails);
    } catch (err) {
      if (!axios.isCancel(err)) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(errorMessage);
      }
    } finally {
      setIsScanning(false);
      abortControllerRef.current = null;
    }
  }, []);

  // Auto-Capture Effect
  React.useEffect(() => {
    if (!isAutoCapture || !isCameraReady || isScanning || scanResult) return;

    const interval = setInterval(() => {
      if (!isScanning) {
        handleScan();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isAutoCapture, isCameraReady, isScanning, handleScan, scanResult]);

  const handleConfirm = () => {
    if (scanResult) {
      onConfirm(scanResult);
      handleClose();
    }
  };

  const handleClose = () => {
    setIsCameraReady(false);
    setIsScanning(false);
    setScanResult(null);
    setError(null);
    setIsAutoCapture(true);
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
    }
    onClose();
  };

  if (!isOpen) return null;

  // Scanner view (before confirmation)
  if (!scanResult) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-50 bg-white rounded-full p-2 text-gray-800 hover:bg-gray-200 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-6 h-6"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/70 to-transparent px-4 py-4">
          <h1 className="text-2xl font-bold text-white text-center">Scan Medicine</h1>
        </div>

        {/* Video */}
        <video
          ref={videoRef}
          className="flex-1 w-full h-full object-cover"
          playsInline
          muted
        />

        {/* Overlay guide box */}
        <div className="absolute inset-0 border-4 border-blue-400 m-12 rounded-lg pointer-events-none"></div>

        {/* Overlay scanning state */}
        {isScanning && (
          <div className="absolute inset-0 bg-white/20 z-10 animate-pulse flex items-center justify-center">
            <span className="text-white font-semibold bg-black/50 px-4 py-2 rounded">
              Processing...
            </span>
          </div>
        )}

        {/* Overlay initializing state */}
        {!isCameraReady && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-white z-10">
            <span className="bg-black/50 px-4 py-2 rounded">Initializing Camera...</span>
          </div>
        )}

        {/* Controls at bottom */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-4 py-8">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            {/* Toggle Auto/Manual */}
            <div className="flex-1 flex items-center justify-center gap-2 bg-black/50 px-4 py-3 rounded-lg">
              <span
                className={`text-xs font-medium ${
                  isAutoCapture ? 'text-blue-400' : 'text-gray-400'
                }`}
              >
                Auto
              </span>
              <button
                onClick={() => setIsAutoCapture(!isAutoCapture)}
                className={`relative inline-flex items-center h-6 w-12 rounded-full transition-colors ${
                  isAutoCapture ? 'bg-charcoal-blue' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isAutoCapture ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span
                className={`text-xs font-medium ${
                  !isAutoCapture ? 'text-blue-400' : 'text-gray-400'
                }`}
              >
                Manual
              </span>
            </div>

            {/* Capture Button (shown in manual mode) */}
            {!isAutoCapture && (
              <button
                onClick={handleScan}
                disabled={!isCameraReady || isScanning}
                className={`flex-1 py-3 rounded-lg font-bold text-white transition-all ${
                  isScanning || !isCameraReady
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-charcoal-blue hover:bg-deep-space-blue active:scale-95'
                }`}
              >
                {isScanning ? 'Scanning...' : 'Capture'}
              </button>
            )}
          </div>
        </div>

        {/* Hidden canvas */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  }

  // Result confirmation view
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto p-6">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-charcoal-blue text-2xl font-bold"
        >
          ×
        </button>

        <h2 className="text-2xl font-bold text-deep-space-blue mb-4 capitalize">
          {scanResult.brand_name}
        </h2>

        <div className="space-y-4 mb-6">
          <div>
            <h3 className="font-semibold text-charcoal-blue text-sm mb-1">How to Take</h3>
            <p className="text-blue-slate">{scanResult.usage_timing}</p>
          </div>

          <div className="flex gap-2">
            {!scanResult.safety_flags.drive && (
              <div className="flex-1 bg-red-100 border border-red-300 rounded-lg p-3 text-center">
                <div className="text-2xl mb-1">
                  <FontAwesomeIcon icon={faCar} className="fa-1x" />
                </div>
                <p className="text-xs font-bold text-red-700">Do Not Drive</p>
              </div>
            )}
            {!scanResult.safety_flags.alcohol && (
              <div className="flex-1 bg-red-100 border border-red-300 rounded-lg p-3 text-center">
                <div className="text-2xl mb-1">
                  <FontAwesomeIcon icon={faWineGlass} className="fa-1x" />
                </div>
                <p className="text-xs font-bold text-red-700">No Alcohol</p>
              </div>
            )}
          </div>

          <div>
            <h3 className="font-semibold text-charcoal-blue text-sm mb-1">Purpose</h3>
            <p className="text-blue-slate text-sm">{scanResult.purpose}</p>
          </div>

          <div>
            <h3 className="font-semibold text-charcoal-blue text-sm mb-1">Active Ingredient</h3>
            <p className="text-blue-slate text-sm">{scanResult.active_ingredient}</p>
          </div>

          {scanResult.warnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <h3 className="font-semibold text-yellow-900 text-sm mb-2 flex items-center gap-2">
                <FontAwesomeIcon icon={faTriangleExclamation} className="fa-1x" />
                Warnings
              </h3>
              <ul className="text-xs text-yellow-800 space-y-1">
                {scanResult.warnings.map((warning, idx) => (
                  <li key={idx} className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setScanResult(null)}
            className="flex-1 py-2 px-4 border border-dim-grey/40 text-charcoal-blue rounded-lg font-semibold hover:bg-rosy-granite/5 transition-colors"
          >
            Scan Again
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-2 px-4 bg-charcoal-blue hover:bg-deep-space-blue text-white rounded-lg font-semibold transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
