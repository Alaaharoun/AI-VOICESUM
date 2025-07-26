import { Tabs } from 'expo-router';
import { Mic, FileText, User, Crown, Settings, Upload, Languages, BookOpen } from 'lucide-react-native';
import { useUserPermissions } from '@/hooks/useAuth';
import { SummaryProvider } from '@/contexts/SummaryContext';

export default function TabLayout() {
  const { isSuperadmin, loading: permissionsLoading } = useUserPermissions();

  console.log('TabLayout: isSuperadmin', isSuperadmin, 'permissionsLoading', permissionsLoading);

  return (
    <SummaryProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#2563EB',
          tabBarInactiveTintColor: '#6B7280',
          tabBarStyle: {
            backgroundColor: 'white',
            borderTopWidth: 1,
            borderTopColor: '#E5E7EB',
            paddingBottom: 8,
            paddingTop: 8,
            height: 88,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontFamily: 'Inter-SemiBold',
            marginTop: 4,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Record',
            tabBarIcon: ({ size, color }) => (
              <Mic size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="live-translation"
          options={{
            title: 'Live Translation',
            tabBarIcon: ({ size, color }) => (
              <Languages size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="upload"
          options={{
            title: 'Upload',
            tabBarIcon: ({ size, color }) => (
              <Upload size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ size, color }) => (
              <User size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="summary-view"
          options={{
            title: 'Summary',
            tabBarIcon: ({ size, color }) => (
              <BookOpen size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            href: null,
          }}
        />
      </Tabs>
    </SummaryProvider>
  );
}