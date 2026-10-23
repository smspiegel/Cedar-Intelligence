import {
  Manrope_200ExtraLight,
  Manrope_300Light,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/manrope';
import {
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from 'react-native';

const manropeFonts = {
  Manrope_200ExtraLight,
  Manrope_300Light,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
};

const familyByWeight: Record<string, string> = {
  '100': 'Manrope_200ExtraLight',
  '200': 'Manrope_200ExtraLight',
  '300': 'Manrope_300Light',
  '400': 'Manrope_400Regular',
  normal: 'Manrope_400Regular',
  '500': 'Manrope_500Medium',
  '600': 'Manrope_600SemiBold',
  '700': 'Manrope_700Bold',
  bold: 'Manrope_700Bold',
  '800': 'Manrope_800ExtraBold',
  '900': 'Manrope_800ExtraBold',
};

const familyFor = (style: TextProps['style'] | TextInputProps['style']) => {
  const weight = (StyleSheet.flatten(style) as TextStyle | undefined)?.fontWeight;
  return familyByWeight[String(weight ?? '400')] ?? 'Manrope_400Regular';
};

const softenAllCaps = (children: TextProps['children']) => typeof children === 'string' && /^[A-Z][A-Z ]{3,}$/.test(children)
  ? children.slice(0, 1) + children.slice(1).toLowerCase()
  : children;

export function useManrope() {
  return useFonts(manropeFonts);
}

/** Shared text primitive that keeps each requested weight on the matching Manrope face. */
export function ManropeText({ style, ...props }: TextProps) {
  return <NativeText {...props} style={[style, { fontFamily: familyFor(style), fontWeight: undefined }]}>{softenAllCaps(props.children)}</NativeText>;
}

/** Shared input primitive, including editors and inline fields. */
export function ManropeTextInput({ style, ...props }: TextInputProps) {
  return <NativeTextInput {...props} style={[style, { fontFamily: familyFor(style), fontWeight: undefined }]} />;
}
