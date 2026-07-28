import { StyleSheet } from "react-native";

import type { useColors } from "@/hooks/useColors";

type Colors = ReturnType<typeof useColors>;

export function createAuthStyles(colors: Colors, topInset: number) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: topInset + 32,
      paddingHorizontal: 24,
    },
    logoRow: {
      alignItems: "center",
      marginBottom: 28,
    },
    appName: {
      fontSize: 26,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      marginTop: 12,
    },
    tagline: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginTop: 4,
      textAlign: "center",
    },
    title: {
      fontSize: 22,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginBottom: 20,
    },
    label: {
      fontSize: 13,
      fontFamily: "Inter_500Medium",
      color: colors.foreground,
      marginBottom: 6,
      marginTop: 14,
    },
    input: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: colors.radius,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
    },
    error: {
      color: colors.destructive,
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      marginTop: 6,
    },
    primaryBtn: {
      backgroundColor: colors.accent,
      borderRadius: colors.radius,
      paddingVertical: 13,
      alignItems: "center",
      marginTop: 22,
    },
    primaryBtnDisabled: {
      opacity: 0.5,
    },
    primaryBtnText: {
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
      color: colors.accentForeground,
    },
    googleBtn: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      paddingVertical: 13,
      marginTop: 12,
    },
    googleBtnText: {
      fontSize: 15,
      fontFamily: "Inter_500Medium",
      color: colors.foreground,
    },
    dividerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginTop: 22,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    dividerText: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    linkRow: {
      flexDirection: "row",
      justifyContent: "center",
      marginTop: 24,
    },
    linkMuted: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    link: {
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
      color: colors.accent,
    },
    secondaryBtn: {
      alignItems: "center",
      paddingVertical: 12,
      marginTop: 12,
    },
    secondaryBtnText: {
      fontSize: 14,
      fontFamily: "Inter_500Medium",
      color: colors.accent,
    },
  });
}
