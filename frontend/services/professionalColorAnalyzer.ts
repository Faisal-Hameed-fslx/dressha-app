/**
 * Professional Color Analyzer Module
 * Advanced color analysis with professional-grade algorithms
 * for fashion and design applications
 */

// Professional Color Naming Database
const PROFESSIONAL_COLOR_NAMES: Record<string, string> = {
  "#FF0000": "Crimson Red",
  "#FF6B6B": "Coral Red",
  "#FF69B4": "Hot Pink",
  "#FF1493": "Deep Pink",
  "#FFB6C1": "Light Pink",
  "#FFA500": "Vibrant Orange",
  "#FF8C00": "Dark Orange",
  "#FFD700": "Gold",
  "#FFFF00": "Bright Yellow",
  "#FFDA03": "Sunflower Yellow",
  "#ADFF2F": "Chartreuse",
  "#00FF00": "Lime Green",
  "#32CD32": "Leaf Green",
  "#228B22": "Forest Green",
  "#008000": "Deep Green",
  "#006666": "Teal",
  "#00CED1": "Turquoise",
  "#00BFFF": "Sky Blue",
  "#0000FF": "Royal Blue",
  "#4169E1": "Cornflower Blue",
  "#000080": "Navy Blue",
  "#800080": "Purple",
  "#9370DB": "Medium Purple",
  "#DDA0DD": "Plum",
  "#A9A9A9": "Dark Gray",
  "#808080": "Medium Gray",
  "#C0C0C0": "Silver",
  "#FFFFFF": "Pure White",
  "#000000": "Pure Black",
  "#8B4513": "Saddle Brown",
  "#D2691E": "Chocolate Brown",
  "#CD853F": "Peru",
};

// Enhanced Color Type Definition
interface ProfessionalColorAnalysis {
  dominantColor: {
    hex: string;
    rgb: { r: number; g: number; b: number };
    name: string;
    confidence: number;
  };
colorPalette: {
  hex: string;
  name: string;
  percentage: number;
  hue: number;
  saturation: number;
  lightness: number;
}[];

  averageColor: {
    hex: string;
    rgb: { r: number; g: number; b: number };
  };
  colorProfile: {
    family: string;
    temperature: "warm" | "cool" | "neutral";
    intensity: "vibrant" | "muted" | "pastel";
    contrast: "high" | "medium" | "low";
  };
  accessibility: {
    luminance: number;
    contrastWithWhite: number;
    contrastWithBlack: number;
    wcagLevel: "AAA" | "AA" | "A" | "Fail";
  };
  recommendations: {
    complementaryColors: string[];
    harmonyScheme: "monochromatic" | "analogous" | "complementary" | "triadic";
    bestFor: string[];
  };
}

// Convert RGB to HSL (Hue, Saturation, Lightness)
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

// Convert RGB to relative luminance (WCAG standard)
export function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Calculate WCAG contrast ratio
export function getContrastRatio(lum1: number, lum2: number): number {
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Get WCAG conformance level
export function getWcagLevel(contrastRatio: number): "AAA" | "AA" | "A" | "Fail" {
  if (contrastRatio >= 7) return "AAA";
  if (contrastRatio >= 4.5) return "AA";
  if (contrastRatio >= 3) return "A";
  return "Fail";
}

// Find closest professional color name
export function getColorName(hex: string): string {
  // Check exact match
  if (PROFESSIONAL_COLOR_NAMES[hex.toUpperCase()]) {
    return PROFESSIONAL_COLOR_NAMES[hex.toUpperCase()];
  }

  // Find closest color by Euclidean distance in RGB space
  const [r, g, b] = [
    parseInt(hex.substring(1, 3), 16),
    parseInt(hex.substring(3, 5), 16),
    parseInt(hex.substring(5, 7), 16),
  ];

  let closestName = "Custom Color";
  let closestDistance = Infinity;

  Object.entries(PROFESSIONAL_COLOR_NAMES).forEach(([refHex, name]) => {
    const [refR, refG, refB] = [
      parseInt(refHex.substring(1, 3), 16),
      parseInt(refHex.substring(3, 5), 16),
      parseInt(refHex.substring(5, 7), 16),
    ];

    const distance = Math.sqrt((r - refR) ** 2 + (g - refG) ** 2 + (b - refB) ** 2);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestName = name;
    }
  });

  return closestName;
}

// Get color temperature
export function getColorTemperature(h: number): "warm" | "cool" | "neutral" {
  if ((h >= 0 && h < 30) || (h >= 330 && h <= 360)) return "warm"; // Red
  if (h >= 30 && h < 90) return "warm"; // Yellow
  if (h >= 90 && h < 150) return "cool"; // Green
  if (h >= 150 && h < 270) return "cool"; // Blue/Cyan
  if (h >= 270 && h < 330) return "neutral"; // Purple/Magenta
  return "neutral";
}

// Determine color intensity
export function getColorIntensity(
  s: number,
  l: number,
): "vibrant" | "muted" | "pastel" {
  if (l > 80) return "pastel";
  if (s < 30) return "muted";
  return "vibrant";
}

// Get complementary colors
export function getComplementaryColors(h: number): string[] {
  const complementary = (h + 180) % 360;
  const analogous1 = (h + 30) % 360;
  const analogous2 = (h - 30 + 360) % 360;

  return [
    `hsl(${complementary}, 70%, 50%)`,
    `hsl(${analogous1}, 70%, 50%)`,
    `hsl(${analogous2}, 70%, 50%)`,
  ];
}

// Determine harmony scheme
export function getHarmonyScheme(
  dominantHue: number,
  paletteHues: number[],
): "monochromatic" | "analogous" | "complementary" | "triadic" {
  const uniqueHues = new Set(paletteHues.map((h) => Math.round(h / 60) * 60));

  if (uniqueHues.size === 1) return "monochromatic";

  // Check complementary
  const hasComplementary = paletteHues.some((h) => {
    const diff = Math.abs(h - dominantHue);
    return diff > 160 && diff < 200;
  });
  if (hasComplementary) return "complementary";

  // Check analogous
  const hasAnalogous = paletteHues.some((h) => {
    const diff = Math.abs(h - dominantHue);
    return diff > 0 && diff < 60;
  });
  if (hasAnalogous) return "analogous";

  return "triadic";
}

// Get style recommendations based on color analysis
export function getStyleRecommendations(
  colorFamily: string,
  temperature: string,
  intensity: string,
): string[] {
  const recommendations: string[] = [];

  if (temperature === "warm") {
    recommendations.push("Earth tones", "Sunset palettes", "Autumn collections");
  } else if (temperature === "cool") {
    recommendations.push("Ocean tones", "Winter palettes", "Modern aesthetics");
  }

  if (intensity === "vibrant") {
    recommendations.push("Bold statements", "Evening wear", "Statement pieces");
  } else if (intensity === "pastel") {
    recommendations.push("Soft elegance", "Minimalist designs", "Casual wear");
  }

  return recommendations;
}

// Analyze color contrast
export function getContrastProfile(
  r: number,
  g: number,
  b: number,
): {
  contrast: "high" | "medium" | "low";
} {
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;

  if (brightness > 200 || brightness < 50) {
    return { contrast: "high" };
  } else if (brightness > 100 && brightness < 150) {
    return { contrast: "low" };
  }
  return { contrast: "medium" };
}

// Main professional analyzer
export function analyzeProfessionalColors(pixels: Uint8Array): ProfessionalColorAnalysis {
  const histogram = new Map<string, number>();
  let totalR = 0,
    totalG = 0,
    totalB = 0;
  let samples = 0;
  const hues: number[] = [];
  const saturations: number[] = [];
  const lightnesses: number[] = [];

  // Scan pixels with stratified sampling for better performance
  const stride = Math.max(1, Math.floor(Math.sqrt(pixels.length / 4 / 10000)));

  for (let i = 0; i < pixels.length; i += 4 * stride) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];

    if (a < 20) continue;

    totalR += r;
    totalG += g;
    totalB += b;
    samples += 1;

    const [h, s, l] = rgbToHsl(r, g, b);
    hues.push(h);
    saturations.push(s);
    lightnesses.push(l);

    // Quantize for palette
    const qR = Math.round(r / 32) * 32;
    const qG = Math.round(g / 32) * 32;
    const qB = Math.round(b / 32) * 32;
    const hex = `#${[Math.min(qR, 255), Math.min(qG, 255), Math.min(qB, 255)]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()}`;

    histogram.set(hex, (histogram.get(hex) || 0) + 1);
  }

  const avgR = samples ? Math.round(totalR / samples) : 0;
  const avgG = samples ? Math.round(totalG / samples) : 0;
  const avgB = samples ? Math.round(totalB / samples) : 0;
  const avgHex = `#${[avgR, avgG, avgB]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;

  const [avgH, avgS, avgL] = rgbToHsl(avgR, avgG, avgB);
  const luminance = getRelativeLuminance(avgR, avgG, avgB);
  const contrastWhite = getContrastRatio(luminance, 1);
  const contrastBlack = getContrastRatio(luminance, 0);

  const paletteEntries = [...histogram.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const colorPalette = paletteEntries.map(([hex, count]) => {
    const [r, g, b] = [
      parseInt(hex.substring(1, 3), 16),
      parseInt(hex.substring(3, 5), 16),
      parseInt(hex.substring(5, 7), 16),
    ];
    const [h, s, l] = rgbToHsl(r, g, b);
    return {
      hex,
      name: getColorName(hex),
      percentage: Math.round((count / samples) * 100),
      hue: h,
      saturation: s,
      lightness: l,
    };
  });

  const temperature = getColorTemperature(avgH);
  const intensity = getColorIntensity(avgS, avgL);
  const { contrast } = getContrastProfile(avgR, avgG, avgB);

  const paletteHues = paletteEntries.map(([hex]) => {
    const [r, g, b] = [
      parseInt(hex.substring(1, 3), 16),
      parseInt(hex.substring(3, 5), 16),
      parseInt(hex.substring(5, 7), 16),
    ];
    return rgbToHsl(r, g, b)[0];
  });

  const harmonyScheme = getHarmonyScheme(avgH, paletteHues);
  const complementaryColors = getComplementaryColors(avgH);
  const recommendations = getStyleRecommendations(
    temperature,
    intensity,
    getColorName(avgHex),
  );

  return {
    dominantColor: {
      hex: avgHex,
      rgb: { r: avgR, g: avgG, b: avgB },
      name: getColorName(avgHex),
      confidence: paletteEntries.length > 0 ? (paletteEntries[0][1] / samples) * 100 : 0,
    },
    colorPalette,
    averageColor: {
      hex: avgHex,
      rgb: { r: avgR, g: avgG, b: avgB },
    },
    colorProfile: {
      family: temperature === "warm" ? "Warm" : temperature === "cool" ? "Cool" : "Neutral",
      temperature,
      intensity,
      contrast,
    },
    accessibility: {
      luminance: parseFloat(luminance.toFixed(3)),
      contrastWithWhite: parseFloat(contrastWhite.toFixed(2)),
      contrastWithBlack: parseFloat(contrastBlack.toFixed(2)),
      wcagLevel: getWcagLevel(Math.max(contrastWhite, contrastBlack)),
    },
    recommendations: {
      complementaryColors,
      harmonyScheme,
      bestFor: recommendations,
    },
  };
}
