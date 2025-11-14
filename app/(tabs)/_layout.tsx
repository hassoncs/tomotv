import {Icon, Label, NativeTabs} from "expo-router/unstable-native-tabs"

export default function TabLayout() {
  return (
    <NativeTabs blurEffect="systemChromeMaterial">
      <NativeTabs.Trigger name="search">
        <Icon sf="magnifyingglass" />
        <Label>Search</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="index">
        <Label>Library</Label>
        <Icon sf="film.fill" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <Label>Settings</Label>
        <Icon sf="gearshape.fill" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="help">
        <Label>Help</Label>
        <Icon sf="questionmark.circle.fill" />
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
