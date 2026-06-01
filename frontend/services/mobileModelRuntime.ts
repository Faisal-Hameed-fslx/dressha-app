import { toByteArray } from "base64-js";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import jpeg from "jpeg-js";
import { Image, NativeModules, Platform } from "react-native";

// Backend model manifest logic removed — models must be supplied locally under MODEL_ROOT

type TopLabel = {
  label: string;
  score: number;
};

type RgbSample = {
  r: number;
  g: number;
  b: number;
};

type DeviceAnalysisResult = {
  model: string;
  modelSource: "mobile-local";
  accelerator: string;
  estimatedRamMb: number;
  topLabels: TopLabel[];
  dominantColors: string[];
  averageColor: string;
  colorFamily: string;
  hue: number;
};

type OrtModule = typeof import("onnxruntime-react-native");
type OrtTensor = InstanceType<OrtModule["Tensor"]>;

const MOBILE_NET_KEY = "mobilenetv4";
const MOBILE_NET_MODEL_FILE = "model_quantized.onnx";
const MOBILE_NET_MODEL_URL =
  "https://huggingface.co/onnx-community/mobilenetv4_conv_small.e2400_r224_in1k/resolve/main/onnx/model_quantized.onnx";
const MODNET_KEY = "modnet";
const MODNET_MODEL_FILE = "model_quantized.onnx";
const MODNET_MODEL_URL =
  "https://huggingface.co/Xenova/modnet/resolve/main/onnx/model_quantized.onnx?download=true";
const MODNET_REF_SIZE = 512;
const MODNET_MASK_THRESHOLD = 0.45;
const ANDROID_EXECUTION_PROVIDERS = ["nnapi", "cpu"];
const LOW_CPU_SESSION_OPTIONS = {
  executionProviders: ANDROID_EXECUTION_PROVIDERS,
  executionMode: "sequential",
  intraOpNumThreads: 1,
  interOpNumThreads: 1,
};
const ESTIMATED_MATTE_RAM_MB = 28;
const ESTIMATED_CLASSIFIER_RAM_MB = 18;
const ESTIMATED_ANALYZER_RAM_MB = 64;

let mobileNetSession: any | null = null;
let modnetSession: any | null = null;
let ortModulePromise: Promise<OrtModule> | null = null;

const loadOrtModule = async (): Promise<OrtModule> => {
  if (!NativeModules.Onnxruntime) {
    const nativeModuleNames = Object.keys(NativeModules || {});
    const preview = nativeModuleNames.slice(0, 20).join(", ");
    throw new Error(
      `onnxruntime-react-native native module is not registered in this Android build. Registered native modules: ${nativeModuleNames.length}. Sample: ${preview || "none"}. Rebuild and reinstall a native Android build that includes OnnxruntimePackage.`,
    );
  }

  if (!ortModulePromise) {
    // Normalize dynamic import to handle CJS/ESM interop: prefer module.default when present
    ortModulePromise = import("onnxruntime-react-native").then((m: any) => m?.default ?? m);
  }

  const mod = await ortModulePromise;

  if (!mod) {
    throw new Error(
      'onnxruntime-react-native module failed to load. Make sure the native module is installed and the app was rebuilt (native dev client or full rebuild).',
    );
  }

  // Basic shape check — provide a clearer error when native runtime isn't initialized
  if (typeof mod.InferenceSession === 'undefined' || typeof mod.Tensor === 'undefined') {
    throw new Error(
      'onnxruntime-react-native appears to be loaded but missing expected exports (InferenceSession/Tensor). This usually means the native runtime is not initialized — rebuild the native app to include the native library.',
    );
  }

  return mod as OrtModule;
};

// helper removed — no remote paths to sanitize when models are local

// Removed backend manifest and download logic. Place your ONNX model file under:
// <documentDirectory>/models/mobilenetv4/*.onnx
// The loader below will search that folder for a .onnx file.

const softmax = (logits: Float32Array | number[]) => {
  const values = Array.from(logits);
  const max = Math.max(...values);
  const exp = values.map((v) => Math.exp(v - max));
  const sum = exp.reduce((acc, value) => acc + value, 0);
  return exp.map((value) => value / (sum || 1));
};

const topKFromLogits = (logits: Float32Array, k = 5): TopLabel[] => {
  const probs = softmax(logits);
  return probs
    .map((score, index) => ({ score, index }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((item) => ({
      label: `imagenet_class_${item.index}`,
      score: item.score,
    }));
};

const rgbToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;

const clampByte = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

const colorDistance = (a: RgbSample, b: RgbSample) => {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
};

const getImageSize = (uri: string) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error),
    );
  });

const computeMatteInputSize = (width: number, height: number) => {
  let resizedWidth: number;
  let resizedHeight: number;

  if (Math.max(width, height) < MODNET_REF_SIZE || Math.min(width, height) > MODNET_REF_SIZE) {
    if (width >= height) {
      resizedHeight = MODNET_REF_SIZE;
      resizedWidth = Math.floor((width / height) * MODNET_REF_SIZE);
    } else {
      resizedWidth = MODNET_REF_SIZE;
      resizedHeight = Math.floor((height / width) * MODNET_REF_SIZE);
    }
  } else {
    resizedWidth = width;
    resizedHeight = height;
  }

  resizedWidth -= resizedWidth % 32;
  resizedHeight -= resizedHeight % 32;

  return {
    width: Math.max(32, resizedWidth),
    height: Math.max(32, resizedHeight),
  };
};

const resizeFloatMaskBilinear = (
  source: Float32Array,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
) => {
  if (sourceWidth === targetWidth && sourceHeight === targetHeight) {
    return source;
  }

  const resized = new Float32Array(targetWidth * targetHeight);
  const scaleX = sourceWidth / targetWidth;
  const scaleY = sourceHeight / targetHeight;

  for (let y = 0; y < targetHeight; y += 1) {
    const sourceY = (y + 0.5) * scaleY - 0.5;
    const y0 = Math.max(0, Math.floor(sourceY));
    const y1 = Math.min(sourceHeight - 1, y0 + 1);
    const yWeight = sourceY - y0;

    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = (x + 0.5) * scaleX - 0.5;
      const x0 = Math.max(0, Math.floor(sourceX));
      const x1 = Math.min(sourceWidth - 1, x0 + 1);
      const xWeight = sourceX - x0;

      const topLeft = source[y0 * sourceWidth + x0];
      const topRight = source[y0 * sourceWidth + x1];
      const bottomLeft = source[y1 * sourceWidth + x0];
      const bottomRight = source[y1 * sourceWidth + x1];

      const top = topLeft * (1 - xWeight) + topRight * xWeight;
      const bottom = bottomLeft * (1 - xWeight) + bottomRight * xWeight;
      resized[y * targetWidth + x] = top * (1 - yWeight) + bottom * yWeight;
    }
  }

  return resized;
};

const buildForegroundComposite = (pixels: Uint8Array, mask: Uint8Array) => {
  const composite = new Uint8Array(pixels.length);
  const totals = { r: 0, g: 0, b: 0, count: 0 };

  for (let i = 0; i < mask.length; i += 1) {
    if (mask[i] !== 1) {
      continue;
    }

    const pixelIndex = i * 4;
    totals.r += pixels[pixelIndex];
    totals.g += pixels[pixelIndex + 1];
    totals.b += pixels[pixelIndex + 2];
    totals.count += 1;
  }

  const fallback = {
    r: pixels.reduce((sum, value, index) => (index % 4 === 0 ? sum + value : sum), 0) / Math.max(1, pixels.length / 4),
    g: pixels.reduce((sum, value, index) => (index % 4 === 1 ? sum + value : sum), 0) / Math.max(1, pixels.length / 4),
    b: pixels.reduce((sum, value, index) => (index % 4 === 2 ? sum + value : sum), 0) / Math.max(1, pixels.length / 4),
  };

  const average = totals.count > 0
    ? {
        r: totals.r / totals.count,
        g: totals.g / totals.count,
        b: totals.b / totals.count,
      }
    : fallback;

  for (let i = 0; i < mask.length; i += 1) {
    const pixelIndex = i * 4;
    if (mask[i] === 1) {
      composite[pixelIndex] = pixels[pixelIndex];
      composite[pixelIndex + 1] = pixels[pixelIndex + 1];
      composite[pixelIndex + 2] = pixels[pixelIndex + 2];
    } else {
      composite[pixelIndex] = clampByte(average.r);
      composite[pixelIndex + 1] = clampByte(average.g);
      composite[pixelIndex + 2] = clampByte(average.b);
    }

    composite[pixelIndex + 3] = 255;
  }

  return composite;
};

const getForegroundMaskFromMatte = (matte: Float32Array, width: number, height: number) => {
  const mask = new Uint8Array(width * height);

  for (let i = 0; i < matte.length; i += 1) {
    mask[i] = matte[i] >= MODNET_MASK_THRESHOLD ? 1 : 0;
  }

  return mask;
};

const ensureModnetModelFile = async () => {
  if (Platform.OS !== "android") {
    return null;
  }

  const documentDirectory = FileSystem.documentDirectory;
  if (!documentDirectory) {
    console.warn("Expo file system document directory is unavailable on this device. Portrait matting will be skipped.");
    return null;
  }

  const modelDirUri = `${documentDirectory}models/${MODNET_KEY}`;
  const modelFileUri = `${modelDirUri}/${MODNET_MODEL_FILE}`;

  const existingFile = await FileSystem.getInfoAsync(modelFileUri);
  if (existingFile.exists) {
    return modelFileUri;
  }

  try {
    await FileSystem.makeDirectoryAsync(modelDirUri, { intermediates: true });
    await FileSystem.downloadAsync(MODNET_MODEL_URL, modelFileUri);
    return modelFileUri;
  } catch (err: any) {
    console.warn(
      `Unable to download MODNet model to ${modelFileUri}. Background removal will be skipped.`,
      err?.message || err,
    );
    return null;
  }
};

const getOrCreateModnetSession = async () => {
  if (Platform.OS !== "android") {
    return null;
  }

  if (modnetSession) {
    return modnetSession;
  }

  const modelPath = await ensureModnetModelFile();
  if (!modelPath) {
    return null;
  }

  let InferenceSession: any;
  try {
    const mod = await loadOrtModule();
    InferenceSession = mod.InferenceSession;
  } catch (err: any) {
    console.warn("onnxruntime-react-native not available for portrait matting", err?.message || err);
    return null;
  }

  try {
    modnetSession = await InferenceSession.create(modelPath, {
      ...LOW_CPU_SESSION_OPTIONS,
    });
  } catch (err: any) {
    console.warn("Failed to create MODNet InferenceSession", err?.message || err);
    return null;
  }

  return modnetSession;
};

const runPortraitMatte = async (imageUri: string) => {
  const session = await getOrCreateModnetSession();
  if (!session) {
    return null;
  }

  const { width: imageWidth, height: imageHeight } = await getImageSize(imageUri);
  const targetSize = computeMatteInputSize(imageWidth, imageHeight);

  const manipulated = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: targetSize.width, height: targetSize.height } }],
    {
      base64: true,
      compress: 1,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );

  if (!manipulated.base64) {
    throw new Error("Failed to prepare image for portrait matting");
  }

  const bytes = toByteArray(manipulated.base64);
  const decoded = jpeg.decode(bytes, { useTArray: true });
  const input = new Float32Array(1 * 3 * targetSize.width * targetSize.height);

  for (let i = 0; i < targetSize.width * targetSize.height; i += 1) {
    const pixelIndex = i * 4;
    input[i] = (decoded.data[pixelIndex] - 127.5) / 127.5;
    input[targetSize.width * targetSize.height + i] = (decoded.data[pixelIndex + 1] - 127.5) / 127.5;
    input[2 * targetSize.width * targetSize.height + i] = (decoded.data[pixelIndex + 2] - 127.5) / 127.5;
  }

  const { Tensor } = await loadOrtModule();
  const inputTensor = new Tensor("float32", input, [1, 3, targetSize.height, targetSize.width]);
  const inputName = session.inputNames[0];
  const outputName = session.outputNames[0];
  const outputs = await session.run({ [inputName]: inputTensor });
  const output = outputs[outputName];

  if (!output || !output.data) {
    throw new Error("Portrait matting model returned no matte output");
  }

  const matteData = output.data instanceof Float32Array
    ? output.data
    : new Float32Array(output.data as number[]);
  const matteWidth = output.dims?.[3] ?? targetSize.width;
  const matteHeight = output.dims?.[2] ?? targetSize.height;
  const resizedMatte = resizeFloatMaskBilinear(matteData, matteWidth, matteHeight, targetSize.width, targetSize.height);

  return {
    width: targetSize.width,
    height: targetSize.height,
    matte: resizedMatte,
    foregroundMask: getForegroundMaskFromMatte(resizedMatte, targetSize.width, targetSize.height),
  };
};

const rgbToHue = (r: number, g: number, b: number) => {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  if (max === min) return 0;

  const d = max - min;
  let h = 0;

  if (max === red) h = (green - blue) / d + (green < blue ? 6 : 0);
  else if (max === green) h = (blue - red) / d + 2;
  else h = (red - green) / d + 4;

  return Math.round(h * 60);
};

const getColorFamily = (hue: number) => {
  if (hue >= 0 && hue < 30) return "warm red";
  if (hue >= 30 && hue < 70) return "warm amber";
  if (hue >= 70 && hue < 170) return "balanced green";
  if (hue >= 170 && hue < 220) return "cool cyan";
  if (hue >= 220 && hue < 290) return "cool blue";
  return "neutral violet";
};

const computeColorStatsFromPixels = (pixels: Uint8Array, foregroundMask?: Uint8Array) => {
  const histogram = new Map<string, number>();
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let samples = 0;

  for (let i = 0; i < pixels.length; i += 4) {
    const pixelIndex = i / 4;
    if (foregroundMask && foregroundMask[pixelIndex] !== 1) {
      continue;
    }

    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];
    if (a < 20) continue;

    totalR += r;
    totalG += g;
    totalB += b;
    samples += 1;

    const qR = Math.round(r / 32) * 32;
    const qG = Math.round(g / 32) * 32;
    const qB = Math.round(b / 32) * 32;
    const hex = rgbToHex(Math.min(qR, 255), Math.min(qG, 255), Math.min(qB, 255));
    histogram.set(hex, (histogram.get(hex) || 0) + 1);
  }

  const avgR = samples ? Math.round(totalR / samples) : 0;
  const avgG = samples ? Math.round(totalG / samples) : 0;
  const avgB = samples ? Math.round(totalB / samples) : 0;
  const hue = rgbToHue(avgR, avgG, avgB);

  return {
    dominantColors: [...histogram.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([hex]) => hex),
    averageColor: rgbToHex(avgR, avgG, avgB),
    colorFamily: getColorFamily(hue),
    hue,
  };
};

const estimateAnalyzerRamMb = () =>
  Math.max(ESTIMATED_ANALYZER_RAM_MB, ESTIMATED_MATTE_RAM_MB + ESTIMATED_CLASSIFIER_RAM_MB + 18);

const buildMobilenetInput = async (
  imageUri: string,
  width: number,
  height: number,
  foregroundMask?: Uint8Array,
): Promise<{ tensor: OrtTensor; pixels: Uint8Array }> => {
  const manipulated = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width, height } }],
    {
      base64: true,
      compress: 1,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );

  if (!manipulated.base64) {
    throw new Error("Failed to prepare image for local inference");
  }

  const bytes = toByteArray(manipulated.base64);
  const decoded = jpeg.decode(bytes, { useTArray: true });
  const sourcePixels = foregroundMask ? buildForegroundComposite(decoded.data, foregroundMask) : decoded.data;
  const input = new Float32Array(1 * 3 * width * height);

  // NCHW: normalize to ImageNet mean/std.
  const mean = [0.485, 0.456, 0.406];
  const std = [0.229, 0.224, 0.225];

  for (let i = 0; i < width * height; i += 1) {
    const r = sourcePixels[i * 4] / 255;
    const g = sourcePixels[i * 4 + 1] / 255;
    const b = sourcePixels[i * 4 + 2] / 255;

    input[i] = (r - mean[0]) / std[0];
    input[width * height + i] = (g - mean[1]) / std[1];
    input[2 * width * height + i] = (b - mean[2]) / std[2];
  }

  const { Tensor } = await loadOrtModule();

  return {
    tensor: new Tensor("float32", input, [1, 3, height, width]),
    pixels: sourcePixels,
  };
};

const ensureMobilenetModelFile = async () => {
  if (Platform.OS !== "android") {
    return null;
  }

  const documentDirectory = FileSystem.documentDirectory;
  if (!documentDirectory) {
    console.warn("Expo file system document directory is unavailable on this device. Color analysis will continue without vision tags.");
    return null;
  }

  const modelDirUri = `${documentDirectory}models/${MOBILE_NET_KEY}`;
  const modelFileUri = `${modelDirUri}/${MOBILE_NET_MODEL_FILE}`;

  const existingFile = await FileSystem.getInfoAsync(modelFileUri);
  if (existingFile.exists) {
    return modelFileUri;
  }

  try {
    await FileSystem.makeDirectoryAsync(modelDirUri, { intermediates: true });
    await FileSystem.downloadAsync(MOBILE_NET_MODEL_URL, modelFileUri);
    return modelFileUri;
  } catch (err: any) {
    console.warn(
      `Unable to download MobileNet model to ${modelFileUri}. Color analysis will continue without vision tags.`,
      err?.message || err,
    );
    return null;
  }
};

const getOrCreateMobilenetSession = async (token: string) => {
  if (Platform.OS !== "android") {
    return null;
  }

  if (mobileNetSession) return mobileNetSession;

  const modelPath = await ensureMobilenetModelFile();
  if (!modelPath) {
    return null;
  }

  const executionProviders =
    Platform.OS === "android"
      ? ANDROID_EXECUTION_PROVIDERS
      : ["cpu"];

  // Try to load the native ONNX runtime; if it's not available or session
  // creation fails, log and return null so callers fall back to non-local analysis.
  let InferenceSession: any;
  try {
    const mod = await loadOrtModule();
    InferenceSession = mod.InferenceSession;
  } catch (err: any) {
    console.warn(
      'onnxruntime-react-native not available — skipping on-device inference',
      err?.message || err,
    );
    return null;
  }

  try {
    mobileNetSession = await InferenceSession.create(modelPath, {
      ...LOW_CPU_SESSION_OPTIONS,
      executionProviders,
    });
  } catch (err: any) {
    console.warn('Failed to create ONNX InferenceSession — skipping local inference', err?.message || err);
    return null;
  }

  return mobileNetSession;
};

const getForegroundMaskForAnalysis = async (imageUri: string, targetWidth: number, targetHeight: number) => {
  try {
    const matteResult = await runPortraitMatte(imageUri);
    if (!matteResult) {
      return null;
    }

    if (matteResult.width === targetWidth && matteResult.height === targetHeight) {
      return matteResult.foregroundMask;
    }

    const resizedMatte = resizeFloatMaskBilinear(
      matteResult.matte,
      matteResult.width,
      matteResult.height,
      targetWidth,
      targetHeight,
    );

    return getForegroundMaskFromMatte(resizedMatte, targetWidth, targetHeight);
  } catch (error) {
    console.warn("Portrait matting failed, falling back to unmasked color analysis", error);
    return null;
  }
};

export const analyzeColorOnDevice = async (
  imageUri: string,
  token: string,
): Promise<DeviceAnalysisResult> => {
  const foregroundMask = await getForegroundMaskForAnalysis(imageUri, 224, 224);
  const { tensor, pixels } = await buildMobilenetInput(imageUri, 224, 224, foregroundMask ?? undefined);
  const session = await getOrCreateMobilenetSession(token);
  const topLabels = session
    ? (() => {
        const inputName = session.inputNames[0];
        const outputName = session.outputNames[0];
        return session.run({ [inputName]: tensor }).then((outputs: any) => {
          const output = outputs[outputName];
          if (!output || !output.data) {
            throw new Error("Model inference returned no output tensor");
          }
          return topKFromLogits(output.data as Float32Array, 5);
        });
      })()
    : Promise.resolve([] as TopLabel[]);
  const resolvedTopLabels = await topLabels;
  const colors = computeColorStatsFromPixels(pixels);

  return {
    model: "onnx-community/mobilenetv4_conv_small.e2400_r224_in1k",
    modelSource: "mobile-local",
    accelerator: Platform.OS === "android" ? "nnapi->cpu" : "cpu",
    estimatedRamMb: estimateAnalyzerRamMb(),
    topLabels: resolvedTopLabels,
    ...colors,
  };
};

export const warmupMobileModels = async (token?: string) => {
  try {
    if (Platform.OS !== "android") {
      return false;
    }

    const modnetSessionInstance = await getOrCreateModnetSession();
    const mobilenetSessionInstance = await getOrCreateMobilenetSession(token as any);
    return Boolean(mobilenetSessionInstance || modnetSessionInstance);
  } catch (err) {
    console.warn('warmupMobileModels failed', err);
    return false;
  }
};

export const unloadMobileModels = async () => {
  if (mobileNetSession) {
    try {
      await mobileNetSession.release();
    } catch (error) {
      console.warn("Failed to release mobile model session", error);
    } finally {
      mobileNetSession = null;
    }
  }

  if (modnetSession) {
    try {
      await modnetSession.release();
    } catch (error) {
      console.warn("Failed to release portrait matting session", error);
    } finally {
      modnetSession = null;
    }
  }

  // no cached manifest to clear — models are local
};
