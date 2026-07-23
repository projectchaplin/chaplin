import { NativeTabs } from "expo-router/unstable-native-tabs";

import { colors } from "@/theme/colors";

export default function TabsLayout() {
  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.elevated}
      labelStyle={{ selected: { color: colors.label } }}
    >
      <NativeTabs.Trigger name="(studio)">
        <NativeTabs.Trigger.Label>Studio</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="rectangle.stack.fill" md="dashboard" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(create)">
        <NativeTabs.Trigger.Label>Create</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="sparkles" md="auto_awesome" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(library)">
        <NativeTabs.Trigger.Label>Library</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="play.square.stack.fill" md="video_library" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
