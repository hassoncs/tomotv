import { useWindowDimensions } from 'react-native';

export function useResponsiveScale() {
  const { width, height } = useWindowDimensions();
  
  // Responsive sizing based on screen dimensions
  const isTV = width >= 1200; // Apple TV or large screen
  const isTablet = width >= 768 && width < 1200;
  const scaleFactor = isTV ? 1.8 : isTablet ? 1.4 : 1;

  const responsiveSize = (baseSize: number): number => {
    return Math.round(baseSize * scaleFactor);
  };

  return {
    scaleFactor,
    responsiveSize,
    isTV,
    isTablet,
    screenWidth: width,
    screenHeight: height,
  };
}