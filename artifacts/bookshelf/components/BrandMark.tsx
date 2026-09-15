import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

interface BrandMarkProps {
  compact?: boolean;
  showTagline?: boolean;
  light?: boolean;
}

export default function BrandMark({
  compact = false,
  showTagline = true,
  light = false,
}: BrandMarkProps) {
  const colors = useColors();
  const foreground = light ? "#fffaf0" : colors.foreground;

  return (
    <View style={styles.row}>
      <View
        style={[
          styles.icon,
          compact && styles.iconCompact,
          { borderColor: colors.accent },
        ]}
      >
        <Ionicons
          name="book-outline"
          size={compact ? 19 : 25}
          color={colors.accent}
        />
        <Ionicons
          name="key-outline"
          size={compact ? 10 : 13}
          color={colors.accent}
          style={styles.key}
        />
      </View>
      <View>
        <Text
          style={[
            styles.name,
            compact && styles.nameCompact,
            { color: foreground },
          ]}
        >
          TomeKeeper
        </Text>
        {showTagline && (
          <Text
            style={[
              styles.tagline,
              compact && styles.taglineCompact,
              { color: light ? "#77c7bd" : colors.brandTeal },
            ]}
          >
            Scan. Organize. Rediscover.
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  iconCompact: {
    width: 34,
    height: 34,
    borderRadius: 10,
  },
  key: {
    position: "absolute",
    right: 3,
    bottom: 3,
    transform: [{ rotate: "-35deg" }],
  },
  name: {
    fontSize: 24,
    lineHeight: 27,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  nameCompact: {
    fontSize: 19,
    lineHeight: 21,
  },
  tagline: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  taglineCompact: {
    fontSize: 9,
  },
});
