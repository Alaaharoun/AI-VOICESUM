import { useEffect } from 'react';
import { usePathname } from 'expo-router';
import { View, Text } from 'react-native';

export default function CatchAll() {
  const pathname = usePathname();
  useEffect(() => {
    console.warn('[CatchAll] تم الوصول لمسار غير معرف:', pathname);
  }, [pathname]);
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 22, color: 'red', marginBottom: 16 }}>⚠️ لا يوجد شاشة لهذا المسار!</Text>
      <Text style={{ fontSize: 16, color: '#333', marginBottom: 8 }}>المسار الحالي: {pathname}</Text>
      <Text style={{ fontSize: 14, color: '#666' }}>إذا رأيت هذه الشاشة، هناك مشكلة في التوجيه أو في Expo Router.</Text>
    </View>
  );
} 