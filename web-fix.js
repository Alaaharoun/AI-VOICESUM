
// إصلاح للويب - إضافة في app/_layout.tsx
import { Platform } from 'react-native';

// إضافة هذا في بداية الملف
if (Platform.OS === 'web') {
  // إصلاح مشاكل الويب
  if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
      console.log('Web error caught:', event.error);
    });
  }
}
