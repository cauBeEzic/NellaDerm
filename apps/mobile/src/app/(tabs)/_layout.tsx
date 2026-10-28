import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';

import { colors, font } from '@/theme';

const icons = {
  index: 'white-balance-sunny',
  ask: 'message-text-outline',
  insights: 'chart-timeline-variant-shimmer',
  care: 'spa',
  profile: 'account',
} as const;

export default function TabLayout() {
  return (
    <Tabs screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: colors.actionPrimary,
      tabBarInactiveTintColor: colors.textSecondary,
      tabBarLabelStyle: { fontFamily: font.medium, fontSize: 11 },
      tabBarStyle: { height: 64, paddingTop: 6, backgroundColor: colors.canvas, borderTopWidth: 0, elevation: 0 },
      tabBarIcon: ({ color, size }) => <MaterialCommunityIcons color={color} name={icons[route.name as keyof typeof icons]} size={size} />,
    })}>
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="insights" options={{ title: 'Insights' }} />
      <Tabs.Screen name="ask" options={{
        title: 'Ask Nella',
        tabBarAccessibilityLabel: 'Ask Nella',
        tabBarLabel: () => null,
        tabBarIcon: () => <MaterialCommunityIcons color={colors.onActionPrimary} name="plus" size={30} style={{ width: 52, height: 52, borderRadius: 26, textAlign: 'center', lineHeight: 52, backgroundColor: colors.actionPrimary }} />,
      }} />
      <Tabs.Screen name="care" options={{ title: 'Care' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
