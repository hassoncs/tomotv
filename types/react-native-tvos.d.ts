import { TouchableOpacityProps } from 'react-native';

declare module 'react-native' {
  interface TouchableOpacityProps {
    isTVSelectable?: boolean;
    hasTVPreferredFocus?: boolean;
  }
}