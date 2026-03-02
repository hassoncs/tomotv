import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";

export default function TabLayout() {
  return (
    <NativeTabs blurEffect="systemChromeMaterial">
      <NativeTabs.Trigger name="index">
        <Icon sf="film.fill" />
        <Label>Library</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="search">
        <Icon sf="magnifyingglass" />
        <Label>Search</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <Icon sf="gearshape.fill" />
        <Label>Settings</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="ai">
        <Icon sf="sparkles" />
        <Label>AI</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
