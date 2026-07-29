import { StyleSheet, Text, View } from 'react-native';

/**
 * Phase 0 placeholder.
 *
 * Replaced in Phase 5 by `export { HomeScreen as default } from '@/features/weather'`.
 * It exists only so the dev client has something to render and the toolchain
 * can be verified end to end.
 */
export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Weather</Text>
      <Text style={styles.subtitle}>Phase 0 — foundation ready</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.6,
  },
});
